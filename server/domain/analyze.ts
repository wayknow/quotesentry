import type {
  AuditEvent,
  CatalogSku,
  Customer,
  DocumentStatus,
  LineStatus,
  PricingRules,
  Quote,
  RfqDocument,
  RfqLine,
} from '../../shared/schema.js';
import { addDaysIso, hashText, makeId, nowIso, round2 } from '../utils.js';
import { extractLines, type ExtractedLine, type ExtractionResult } from './extraction.js';
import { evaluateGate, FIELD_LABELS } from './gate.js';
import type { LlmConfig } from '../llm/client.js';
import { matchCatalog } from './matcher.js';
import { calculateQuoteTotals, isBelowMarginFloor, priceCatalogLine } from './pricing.js';

export interface AnalysisDependencies {
  customer: Customer;
  catalog: CatalogSku[];
  rules: PricingRules;
  llm?: LlmConfig;
}

export async function analyzeDocument(doc: RfqDocument, deps: AnalysisDependencies): Promise<RfqDocument> {
  const extraction = await extractLines(doc.rawText, doc.sourceType, deps.llm);
  return applyExtraction(doc, extraction, deps);
}

export function applyExtraction(
  doc: RfqDocument,
  extraction: ExtractionResult,
  deps: AnalysisDependencies,
): RfqDocument {
  const at = nowIso();
  const lines = extraction.lines.map((line) => inspectLine(doc.id, line, deps.catalog, deps.customer, deps.rules));
  const pricingLines = lines.filter((line) => line.pricing !== null);
  let totals = pricingLines.length > 0
    ? calculateQuoteTotals(pricingLines.map((line) => line.pricing!), deps.rules)
    : null;

  if (totals && isBelowMarginFloor(totals, deps.rules)) {
    for (const line of lines) {
      if (!line.pricing) continue;
      line.status = 'MARGIN_ALERT';
      line.conflicts.push(
        `报价整体毛利率 ${totals.marginPct.toFixed(2)}%，低于底线 ${deps.rules.minimumMarginPct.toFixed(2)}%；需要主管填写原因后 override。`,
      );
    }
  }

  const quote = pricingLines.length > 0 && totals
    ? buildQuote(doc, deps, lines, totals, at)
    : null;

  const status = deriveDocumentStatus(lines);
  const auditEvent: AuditEvent = {
    id: makeId('aud'),
    at,
    type: 'ANALYZED',
    actor: extraction.engineMode === 'llm' ? `agent:${extraction.model}` : 'agent:rules',
    message: extraction.engineNote,
    model: extraction.model,
    promptVersion: 'fastener-rfq-v1',
    catalogRevision: hashText(JSON.stringify(deps.catalog)).slice(0, 12),
    pricingRuleVersion: deps.rules.version,
    inputHash: doc.inputHash,
    outputHash: hashText(JSON.stringify({ lines, quote })),
    detail: {
      lineCount: lines.length,
      ready: lines.filter((line) => line.status === 'PRICED').length,
      needsClarification: lines.filter((line) => line.status === 'NEEDS_CLARIFICATION').length,
      noMatch: lines.filter((line) => line.status === 'NO_MATCH').length,
      marginAlert: lines.filter((line) => line.status === 'MARGIN_ALERT').length,
    },
  };

  return {
    ...doc,
    status,
    engineMode: extraction.engineMode,
    engineNote: extraction.engineNote,
    lines,
    quotes: quote ? [...doc.quotes, quote] : doc.quotes,
    currentQuoteId: quote?.id ?? null,
    updatedAt: at,
    audit: [...doc.audit, auditEvent],
  };
}

function inspectLine(
  documentId: string,
  extracted: ExtractedLine,
  catalog: CatalogSku[],
  customer: Customer,
  rules: PricingRules,
): RfqLine {
  const gate = evaluateGate(extracted);
  let status: LineStatus = 'NEEDS_CLARIFICATION';
  let matchedSku: CatalogSku | null = null;
  let matchReason: string | null = null;
  let pricing = null;
  const conflicts = [...gate.conflicts];

  if (gate.ready) {
    const match = matchCatalog(extracted, catalog);
    matchedSku = match.sku;
    matchReason = match.reason;
    if (!match.sku) {
      status = 'NO_MATCH';
    } else {
      pricing = priceCatalogLine({ sku: match.sku, quantity: extracted.quantity!, customer, rules });
      status = 'PRICED';
    }
  }

  return {
    id: makeId('line'),
    documentId,
    lineIndex: extracted.lineIndex,
    rawText: extracted.sourceLine,
    evidence: buildEvidence(extracted),
    productType: extracted.productType,
    standard: extracted.standard,
    diameterMm: extracted.diameterMm,
    lengthMm: extracted.lengthMm,
    threadPitchMm: extracted.threadPitchMm,
    material: extracted.material,
    strengthGrade: extracted.strengthGrade,
    surfaceTreatment: extracted.surfaceTreatment,
    quantity: extracted.quantity,
    unit: extracted.unit,
    status,
    missingFields: gate.missingFields,
    conflicts,
    matchedSku: matchedSku?.sku ?? null,
    matchedSkuName: matchedSku?.name ?? null,
    matchReason,
    clarification: buildClarification(extracted, gate.missingFields, gate.conflicts, status),
    pricing,
  };
}

function buildEvidence(line: ExtractedLine) {
  if (!line.evidenceVerified || !line.sourceLine.trim()) {
    return [{
      text: line.sourceLine || '（未返回原文片段）',
      location: line.evidenceLocation,
      verified: false,
      kind: 'direct' as const,
      field: null,
    }];
  }

  const fields: Array<[string, unknown]> = [
    ['productType', line.productType],
    ['standard', line.standard],
    ['diameterMm', line.diameterMm],
    ['lengthMm', line.lengthMm],
    ['threadPitchMm', line.threadPitchMm],
    ['material', line.material],
    ['strengthGrade', line.strengthGrade],
    ['surfaceTreatment', line.surfaceTreatment],
    ['quantity', line.quantity],
    ['unit', line.unit],
  ];

  return fields
    .filter(([, value]) => value !== null && value !== '')
    .map(([field]) => ({
      text: line.sourceLine,
      location: line.evidenceLocation,
      verified: true,
      kind: 'direct' as const,
      field,
    }));
}

function buildQuote(
  doc: RfqDocument,
  deps: AnalysisDependencies,
  lines: RfqLine[],
  totals: ReturnType<typeof calculateQuoteTotals>,
  createdAt: string,
): Quote {
  return {
    id: makeId('quote'),
    documentId: doc.id,
    version: doc.quotes.length + 1,
    status: 'READY_FOR_APPROVAL',
    customerId: doc.customerId,
    currency: 'USD',
    incoterm: deps.customer.incoterm,
    lines: lines.flatMap((line) => line.pricing ? [{
      id: makeId('ql'),
      rfqLineId: line.id,
      sku: line.pricing.sku,
      name: line.pricing.name,
      quantity: line.pricing.quantity,
      unit: line.pricing.unit,
      unitPriceCny: line.pricing.unitPriceCny,
      lineNetCny: line.pricing.lineNetCny,
      lineCostCny: line.pricing.lineCostCny,
      lineMarginPct: line.pricing.lineMarginPct,
      currencyAmount: line.pricing.currencyAmount,
      tierLabel: line.pricing.tierLabel,
    }] : []),
    netSalesCny: totals.netSalesCny,
    totalCostCny: totals.totalCostCny,
    feesCny: totals.feesCny,
    marginCny: totals.marginCny,
    marginPct: totals.marginPct,
    currencyTotal: round2(totals.currencyTotal),
    validUntil: addDaysIso(deps.rules.validDays),
    overrides: [],
    createdAt,
    approvedAt: null,
    approvedBy: null,
  };
}

function buildClarification(
  line: ExtractedLine,
  missingFields: string[],
  conflicts: string[],
  status: LineStatus,
): string | null {
  if (status === 'PRICED' || status === 'MARGIN_ALERT') return null;

  const asks: string[] = [];
  const customerFields = missingFields.filter((field) => field !== 'evidence');
  if (customerFields.length > 0) {
    asks.push(`Please confirm the following specification fields: ${customerFields.map(customerFieldLabel).join(', ')}.`);
  }
  if (missingFields.includes('evidence')) {
    asks.push('We could not verify this line against the original message; please resend the complete product line.');
  }
  if (line.unit && line.unit !== 'pcs') {
    asks.push('Please confirm the order quantity in pieces (pcs); we cannot convert boxes, sets, or kilograms without an agreed packing rule.');
  }
  if (line.standard && conflicts.some((item) => item.includes('无法识别标准'))) {
    asks.push('Please confirm the applicable standard: DIN 933 / ISO 4017 / GB/T 5783 for full thread, or DIN 931 / ISO 4014 / GB/T 5782 for partial thread.');
  }
  if (status === 'NO_MATCH') {
    asks.push('This exact specification is not in our current catalog. Please confirm the dimensions, grade, material, and surface finish before we review an alternative.');
  }

  return asks.length > 0 ? asks.join(' ') : 'Please confirm the product specification before we prepare a quotation.';
}

function customerFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    productType: 'product type',
    standard: 'standard',
    diameterMm: 'nominal diameter',
    lengthMm: 'length',
    threadPitchMm: 'thread pitch',
    material: 'material',
    strengthGrade: 'property class',
    surfaceTreatment: 'surface treatment',
    quantity: 'quantity',
    unit: 'unit',
  };
  return labels[field] ?? (FIELD_LABELS[field] ?? field);
}

export function deriveDocumentStatus(lines: RfqLine[]): DocumentStatus {
  if (lines.length === 0) return 'FAILED';
  const approved = lines.every((line) => line.status === 'APPROVED');
  if (approved) return 'APPROVED';
  const hasPriced = lines.some((line) => ['PRICED', 'MARGIN_ALERT', 'APPROVED'].includes(line.status));
  const hasBlocked = lines.some((line) => ['NEEDS_CLARIFICATION', 'NO_MATCH', 'MARGIN_ALERT', 'REJECTED'].includes(line.status));
  if (hasPriced && !hasBlocked) return 'READY_FOR_APPROVAL';
  return 'NEEDS_REVIEW';
}
