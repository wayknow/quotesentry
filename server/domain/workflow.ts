import type { Customer, PricingRules, Quote, RfqDocument, RfqLine } from '../../shared/schema.js';
import { AppError } from '../errors.js';
import { makeId, nowIso, round2 } from '../utils.js';
import { deriveDocumentStatus } from './analyze.js';

export function overrideMarginAlert(
  doc: RfqDocument,
  lineId: string,
  reason: string,
  actor: string,
): RfqDocument {
  const at = nowIso();
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new AppError(400, 'OVERRIDE_REASON_REQUIRED', 'Override 原因至少需要 5 个字符。');
  }

  const line = doc.lines.find((item) => item.id === lineId);
  if (!line) {
    throw new AppError(404, 'LINE_NOT_FOUND', '审单结果中不存在该行。');
  }
  if (line.status !== 'MARGIN_ALERT') {
    throw new AppError(409, 'OVERRIDE_NOT_ALLOWED', '只有毛利越界行需要 override；缺参和目录外不能靠 override 放行。');
  }

  const quote = getCurrentQuote(doc);
  if (quote.status === 'APPROVED' || quote.status === 'EXPORTED') {
    throw new AppError(409, 'QUOTE_LOCKED', '报价已审批或导出，不能再次 override。');
  }

  const quoteLine = quote.lines.find((item) => item.rfqLineId === lineId);
  if (!quoteLine) {
    throw new AppError(404, 'LINE_NOT_IN_QUOTE', '该行不在当前报价中，不能 override。');
  }

  line.status = 'PRICED';
  quote.overrides = [
    ...quote.overrides.filter((item) => item.lineId !== lineId),
    { lineId, reason: cleanReason, actor: actor.trim() || 'supervisor', at },
  ];

  const audit = {
    id: makeId('aud'),
    at,
    type: 'OVERRIDE',
    actor: actor.trim() || 'supervisor',
    message: `毛利越界 override：${line.matchedSku ?? line.id} · ${cleanReason}`,
    inputHash: doc.inputHash,
    detail: { lineId, sku: line.matchedSku, reason: cleanReason },
  };

  return {
    ...doc,
    lines: [...doc.lines],
    quotes: doc.quotes.map((item) => item.id === quote.id ? quote : item),
    status: deriveDocumentStatus(doc.lines),
    updatedAt: at,
    audit: [...doc.audit, audit],
  };
}

export function approveQuote(doc: RfqDocument, actor: string, pricingRuleVersion?: string): RfqDocument {
  const at = nowIso();
  const quote = getCurrentQuote(doc);
  const approver = actor.trim();
  if (!approver) throw new AppError(400, 'ACTOR_REQUIRED', '审批人不能为空。');
  if (quote.status !== 'READY_FOR_APPROVAL') {
    throw new AppError(409, 'QUOTE_NOT_APPROVABLE', `当前报价状态为 ${quote.status}，不能审批。`);
  }
  if (quote.lines.length === 0) {
    throw new AppError(409, 'EMPTY_QUOTE', '当前询价没有可报价行。');
  }

  for (const quoteLine of quote.lines) {
    const line = doc.lines.find((item) => item.id === quoteLine.rfqLineId);
    if (!line || !line.pricing) {
      throw new AppError(409, 'QUOTE_LINE_INVALID', '报价行与审单结果不一致，请重新分析。');
    }
    if (line.status === 'MARGIN_ALERT') {
      throw new AppError(409, 'MARGIN_OVERRIDE_REQUIRED', '存在毛利越界行；请主管填写 override 原因后再审批。');
    }
    if (line.status !== 'PRICED') {
      throw new AppError(409, 'LINE_NOT_APPROVABLE', `行 ${line.lineIndex} 当前状态为 ${line.status}，不能审批。`);
    }
  }

  const nextQuote: Quote = {
    ...quote,
    status: 'APPROVED',
    approvedAt: at,
    approvedBy: approver,
  };

  for (const line of doc.lines) {
    if (nextQuote.lines.some((item) => item.rfqLineId === line.id)) {
      line.status = 'APPROVED';
    }
  }

  const audit = {
    id: makeId('aud'),
    at,
    type: 'APPROVED',
    actor: approver,
    message: `审批通过报价 v${quote.version}；包含 ${quote.lines.length} 行，客户金额 ${quote.currency} ${quote.currencyTotal.toFixed(2)}。`,
    pricingRuleVersion: pricingRuleVersion ?? null,
    inputHash: doc.inputHash,
    detail: { quoteId: quote.id, marginPct: quote.marginPct, lineCount: quote.lines.length },
  };

  return {
    ...doc,
    lines: [...doc.lines],
    quotes: doc.quotes.map((item) => item.id === quote.id ? nextQuote : item),
    status: deriveDocumentStatus(doc.lines),
    updatedAt: at,
    audit: [...doc.audit, audit],
  };
}

export function markExported(doc: RfqDocument, actor: string): RfqDocument {
  const quote = getCurrentQuote(doc);
  if (quote.status !== 'APPROVED' && quote.status !== 'EXPORTED') {
    throw new AppError(409, 'QUOTE_NOT_APPROVED', '报价必须先审批，才能导出客户文件。');
  }
  if (quote.status === 'EXPORTED') return doc;

  const at = nowIso();
  const nextQuote: Quote = { ...quote, status: 'EXPORTED' };
  const unresolved = doc.lines.some((line) => line.status !== 'APPROVED');
  const audit = {
    id: makeId('aud'),
    at,
    type: 'EXPORTED',
    actor: actor.trim() || 'sales',
    message: `导出客户报价 v${quote.version}（客户可见内容，不含成本与毛利）。`,
    inputHash: doc.inputHash,
    detail: { quoteId: quote.id, unresolvedLinesExcluded: unresolved },
  };

  return {
    ...doc,
    status: unresolved ? 'NEEDS_REVIEW' : 'EXPORTED',
    quotes: doc.quotes.map((item) => item.id === quote.id ? nextQuote : item),
    updatedAt: at,
    audit: [...doc.audit, audit],
  };
}

export function assertSendAllowed(sendMode: string): void {
  if (sendMode === 'disabled') {
    throw new AppError(403, 'SEND_DISABLED', 'SEND_MODE=disabled：比赛版禁止向客户外发，只允许审批后导出。');
  }
  throw new AppError(501, 'SEND_NOT_CONFIGURED', '未配置真实发送通道；系统不会伪装成已发送。');
}

export function getCurrentQuote(doc: RfqDocument): Quote {
  const quote = doc.quotes.find((item) => item.id === doc.currentQuoteId);
  if (!quote) throw new AppError(409, 'NO_QUOTE', '当前询价还没有生成报价，请先分析。');
  return quote;
}

export interface CustomerExportLine {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
  amountUsd: number;
}

export interface CustomerExportData {
  quoteId: string;
  customerName: string;
  incoterm: string;
  validUntil: string;
  currency: string;
  totalUsd: number;
  lines: CustomerExportLine[];
}

export function buildCustomerExport(
  quote: Quote,
  customer: Customer,
  rules: PricingRules,
): CustomerExportData {
  return {
    quoteId: quote.id,
    customerName: customer.name,
    incoterm: quote.incoterm,
    validUntil: quote.validUntil,
    currency: quote.currency,
    totalUsd: quote.currencyTotal,
    lines: quote.lines.map((line) => ({
      sku: line.sku,
      description: line.name,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceUsd: round2(line.unitPriceCny / rules.cnyPerUnitCurrency),
      amountUsd: line.currencyAmount,
    })),
  };
}

export function lineById(doc: RfqDocument, lineId: string): RfqLine | undefined {
  return doc.lines.find((line) => line.id === lineId);
}
