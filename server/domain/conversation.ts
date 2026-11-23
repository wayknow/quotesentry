import type {
  ChatAction,
  ChatPayload,
  ChatTurn,
  Quote,
  RfqDocument,
  RfqLine,
} from '../../shared/schema.js';
import { AppError } from '../errors.js';
import { makeId, nowIso } from '../utils.js';
import { analyzeDocument, applyExtraction, type AnalysisDependencies } from './analyze.js';
import type { ExtractedLine } from './extraction.js';
import { FIELD_LABELS } from './gate.js';
import {
  normalizeMaterial,
  normalizeStrength,
  normalizeSurface,
  normalizeUnit,
} from './normalization.js';
import { normalizeStandard } from './standards.js';

type ConversationIntent = 'analyze' | 'update' | 'approve' | 'export' | 'explain' | 'summary';
type LinePatch = Partial<Pick<ExtractedLine,
  'productType' | 'standard' | 'diameterMm' | 'lengthMm' | 'threadPitchMm' |
  'material' | 'strengthGrade' | 'surfaceTreatment' | 'quantity' | 'unit'
>>;

export interface ConversationDependencies extends AnalysisDependencies {
  actor?: string;
}

export async function handleAgentTurn(
  document: RfqDocument,
  message: string,
  deps: ConversationDependencies,
): Promise<RfqDocument> {
  const text = message.trim();
  if (!text) throw new AppError(400, 'CHAT_MESSAGE_REQUIRED', '请输入对话内容。');

  let doc = appendUserTurn(document, text);
  const locked = doc.quotes.some((quote) => ['APPROVED', 'EXPORTED'].includes(quote.status));

  if (doc.lines.length === 0) {
    if (locked) return appendAssistantTurn(doc, blockedPayload('报价已锁定', '这份询价已审批，不能重新分析。', [openReviewAction()]), '报价已锁定。');
    doc = await analyzeDocument(doc, deps);
    return appendAssistantTurn(doc, analysisPayload(doc, '首轮审单完成'), '首轮审单完成。');
  }

  const intent = classifyIntent(text);
  if (intent === 'approve') return handleApprove(doc);
  if (intent === 'export') return handleExport(doc);
  if (intent === 'explain') return handleExplain(doc, text);
  if (intent === 'analyze') {
    if (locked) return appendAssistantTurn(doc, blockedPayload('报价已锁定', '报价已经审批或导出，不能重新分析；如需重做，请新建询价。', [openReviewAction()]), '报价已锁定。');
    doc = await analyzeDocument(doc, deps);
    return appendAssistantTurn(doc, analysisPayload(doc, '重新审单完成'), '重新审单完成。');
  }

  if (locked) {
    return appendAssistantTurn(
      doc,
      blockedPayload('报价已锁定', '报价已经审批，不能再改规格或价格；可以下载客户 CSV/PDF，或新建一份询价继续。', downloadActions()),
      '报价已锁定。',
    );
  }

  const patch = parseLinePatch(text, doc.lines);
  if (patch) {
    doc = applyLinePatch(doc, patch, deps, text);
    return appendAssistantTurn(doc, analysisPayload(doc, '补充信息已写入，已重新审单'), '补充信息已写入并重新审单。');
  }

  return appendAssistantTurn(
    doc,
    summaryPayload(doc, '当前审单状态'),
    '我暂时没有识别到可写入的规格字段；可以继续问我为什么某行不能报，或直接补充规格。',
  );
}

function classifyIntent(text: string): ConversationIntent {
  if (/(审批|批准|通过|确认报价|确认这份|approve|approval)/i.test(text)) return 'approve';
  if (/(导出|下载|csv|pdf|export)/i.test(text)) return 'export';
  if (/(为什么|原因|解释|怎么回事|why|explain)/i.test(text)) return 'explain';
  if (/(重新分析|再审|审一下|分析|审单|看看这封|review|analy[sz]e)/i.test(text)) return 'analyze';
  return 'update';
}

function handleApprove(doc: RfqDocument): RfqDocument {
  const quote = currentQuote(doc);
  if (!quote) {
    return appendAssistantTurn(doc, blockedPayload('还不能审批', '当前还没有报价，请先完成首轮审单。', [{ kind: 'open_review', label: '去审单工作台' }]), '还不能审批。');
  }
  if (quote.status === 'APPROVED' || quote.status === 'EXPORTED') {
    return appendAssistantTurn(doc, approvedPayload(doc, quote, '这份报价已经审批，可以直接下载客户文件。'), '报价已审批。');
  }
  if (quote.status !== 'READY_FOR_APPROVAL') {
    return appendAssistantTurn(doc, blockedPayload('暂时不能审批', `当前报价状态是 ${quote.status}，还不能审批。`, [openReviewAction()]), '暂时不能审批。');
  }

  const summary = '报价已经生成，但我不会在对话里代替主管审批。请到报价审批页核对成本、毛利和异常，再由审批人确认。';
  return appendAssistantTurn(
    doc,
    payloadFor(doc, 'summary', '请到审批页确认', summary, null, [
      { kind: 'approve', label: '去报价审批' },
      openReviewAction(),
    ]),
    '审批需要主管在报价审批页确认。',
  );
}

function handleExport(doc: RfqDocument): RfqDocument {
  const quote = currentQuote(doc);
  if (!quote) {
    return appendAssistantTurn(doc, blockedPayload('还没有可导出的报价', '请先完成审单并生成报价。', [openReviewAction()]), '还没有可导出的报价。');
  }
  if (quote.status !== 'APPROVED' && quote.status !== 'EXPORTED') {
    return appendAssistantTurn(
      doc,
      blockedPayload('导出前需要审批', '客户文件只能从已审批报价导出。请先在报价审批页确认金额和毛利。', [
        { kind: 'approve', label: '去报价审批' },
        openReviewAction(),
      ]),
      '导出前需要审批。',
    );
  }
  return appendAssistantTurn(doc, approvedPayload(doc, quote, '客户文件已可下载；系统不会向客户自动外发。'), '客户文件已可下载。');
}

function handleExplain(doc: RfqDocument, text: string): RfqDocument {
  const line = resolveLine(text, doc.lines);
  if (!line) {
    return appendAssistantTurn(doc, summaryPayload(doc, '当前审单状态'), '请告诉我具体行号，例如“为什么第三行不能报价”。');
  }

  const reasons: string[] = [];
  if (line.missingFields.length > 0) {
    reasons.push(`缺少 ${line.missingFields.filter((field) => field !== 'evidence').map(fieldLabel).join('、')}`);
  }
  reasons.push(...line.conflicts);
  if (line.status === 'NO_MATCH' && line.matchReason) reasons.push(line.matchReason);
  if (line.status === 'MARGIN_ALERT') reasons.push('当前报价低于毛利底线，需要主管 override。');

  const summary = reasons.length > 0
    ? `ROW ${String(line.lineIndex).padStart(2, '0')} 当前是${statusLabel(line.status)}：${reasons.join('；')}。`
    : `ROW ${String(line.lineIndex).padStart(2, '0')} 当前是${statusLabel(line.status)}，没有新的阻断原因。`;
  const payload = payloadFor(doc, 'explanation', `ROW ${String(line.lineIndex).padStart(2, '0')} 解释`, summary, null, [openReviewAction()]);
  return appendAssistantTurn(doc, payload, summary);
}

function applyLinePatch(
  doc: RfqDocument,
  patch: { lineIndex: number; fields: LinePatch; description: string },
  deps: ConversationDependencies,
  message: string,
): RfqDocument {
  const lines = doc.lines.map((line) => toExtractedLine(line));
  const target = lines.find((line) => line.lineIndex === patch.lineIndex);
  if (!target) throw new AppError(404, 'CHAT_LINE_NOT_FOUND', '没有找到要补充的询价行。');
  Object.assign(target, patch.fields);

  const analyzed = applyExtraction(doc, {
    lines,
    engineMode: doc.engineMode,
    engineNote: `对话补充后重新审单：${patch.description}。人工补充字段已标记为 human evidence。`,
    model: null,
  }, deps);

  const fields = Object.keys(patch.fields);
  const withHumanEvidence = analyzed.lines.map((line) => line.lineIndex === patch.lineIndex ? {
    ...line,
    evidence: [
      ...line.evidence,
      ...fields.map((field) => ({
        text: `人工补充：${message}`,
        location: '对话补充 / human clarification',
        verified: true,
        kind: 'human' as const,
        field,
      })),
    ],
  } : line);

  return {
    ...analyzed,
    lines: withHumanEvidence,
    audit: [
      ...analyzed.audit,
      {
        id: makeId('aud'),
        at: nowIso(),
        type: 'CHAT_UPDATE',
        actor: 'sales',
        message: `对话补充 ROW ${String(patch.lineIndex).padStart(2, '0')}：${patch.description}`,
        inputHash: doc.inputHash,
        detail: { lineIndex: patch.lineIndex, fields: patch.fields },
      },
    ],
  };
}

function parseLinePatch(text: string, lines: RfqLine[]): { lineIndex: number; fields: LinePatch; description: string } | null {
  const line = resolveLine(text, lines);
  if (!line) return null;
  const fields: LinePatch = {};
  const descriptions: string[] = [];

  const surface = extractSurface(text);
  if (surface) {
    fields.surfaceTreatment = surface;
    descriptions.push(`表面处理=${surface}`);
  }

  const material = extractMaterial(text);
  if (material) {
    fields.material = material;
    descriptions.push(`材质=${material}`);
  }

  const strength = text.match(/\b(8\.8|10\.9|12\.9|A2-?70|A4-?80)\b/i)?.[1];
  if (strength) {
    fields.strengthGrade = normalizeStrength(strength);
    descriptions.push(`强度=${fields.strengthGrade}`);
  }

  const standard = text.match(/\b(DIN\s*(?:933|931)|ISO\s*(?:4017|4014)|GB\s*\/?\s*T\s*578[23])\b/i)?.[1];
  if (standard) {
    fields.standard = normalizeStandard(standard);
    descriptions.push(`标准=${fields.standard}`);
  }

  const dimension = text.match(/\bM(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (dimension) {
    fields.diameterMm = Number(dimension[1]);
    fields.lengthMm = Number(dimension[2]);
    descriptions.push(`尺寸=M${dimension[1]}x${dimension[2]}`);
  }

  const pitch = text.match(/(?:P|螺距\s*)(\d+(?:\.\d+)?)/i)?.[1];
  if (pitch) {
    fields.threadPitchMm = Number(pitch);
    descriptions.push(`螺距=${pitch}`);
  }

  const quantity = text.match(/(\d[\d,]*)\s*(pcs|pieces?|件|个)?/i);
  if (quantity && /(?:数量|改成|改为|是|=|:|：)\s*\d/i.test(text) && !dimension) {
    const value = Number(quantity[1].replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) {
      fields.quantity = value;
      descriptions.push(`数量=${value}`);
    }
  }

  const unitText = text.match(/\b(pcs|pieces?|boxes?|sets?|kgs?)\b/i)?.[1];
  if (unitText) {
    fields.unit = normalizeUnit(unitText);
    descriptions.push(`单位=${fields.unit}`);
  }

  if (descriptions.length === 0) return null;
  return { lineIndex: line.lineIndex, fields, description: descriptions.join('，') };
}

function resolveLine(text: string, lines: RfqLine[]): RfqLine | null {
  const numeric = text.match(/(?:第\s*|row\s*|line\s*|行\s*)([一二三四五六七八九十\d]+)/i)?.[1];
  if (numeric) {
    const index = chineseNumber(numeric);
    const found = lines.find((line) => line.lineIndex === index);
    if (found) return found;
  }
  const blocked = lines.filter((line) => ['NEEDS_CLARIFICATION', 'NO_MATCH', 'MARGIN_ALERT'].includes(line.status));
  if (blocked.length === 1) return blocked[0];
  return lines.find((line) => line.missingFields.length > 0) ?? lines[0] ?? null;
}

function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return map[value] ?? 1;
}

function extractSurface(text: string): string | null {
  if (/热镀锌|热浸锌|hot[- ]?dip|hdg/i.test(text)) return 'hdg';
  if (/镀锌|电镀锌|白锌|蓝白锌|zinc|zn/i.test(text)) return 'zinc';
  if (/本色|发黑|未处理|plain|black/i.test(text)) return 'plain';
  const match = text.match(/(?:表面处理|表面|finish|surface)\s*(?:是|为|改成|改为|=|:|：)?\s*([a-z0-9_\-]+)/i);
  return match ? normalizeSurface(match[1]) : null;
}

function extractMaterial(text: string): string | null {
  if (/(?:ss\s*316|316|a4)/i.test(text)) return 'SS316';
  if (/(?:ss\s*304|304|a2|不锈钢)/i.test(text)) return 'SS304';
  if (/碳钢|carbon|steel/i.test(text)) return 'carbon_steel';
  const match = text.match(/(?:材质|material)\s*(?:是|为|改成|改为|=|:|：)?\s*([a-z0-9_\-]+)/i);
  return match ? normalizeMaterial(match[1]) : null;
}

function toExtractedLine(line: RfqLine): ExtractedLine {
  const evidence = line.evidence.find((item) => item.verified) ?? line.evidence[0];
  return {
    lineIndex: line.lineIndex,
    sourceLine: line.rawText,
    evidenceLocation: evidence?.location ?? `row ${line.lineIndex}`,
    evidenceVerified: evidence?.verified ?? false,
    productType: line.productType,
    standard: line.standard,
    diameterMm: line.diameterMm,
    lengthMm: line.lengthMm,
    threadPitchMm: line.threadPitchMm,
    material: line.material,
    strengthGrade: line.strengthGrade,
    surfaceTreatment: line.surfaceTreatment,
    quantity: line.quantity,
    unit: line.unit,
  };
}

function analysisPayload(doc: RfqDocument, title: string): ChatPayload {
  return payloadFor(doc, 'analysis', title, analysisSummary(doc), nextQuestion(doc), nextActions(doc));
}

function summaryPayload(doc: RfqDocument, title: string): ChatPayload {
  return payloadFor(doc, 'summary', title, analysisSummary(doc), nextQuestion(doc), nextActions(doc));
}

function approvedPayload(doc: RfqDocument, quote: Quote, summary: string): ChatPayload {
  return payloadFor(doc, 'approved', '报价已审批', summary, '可以下载客户 CSV/PDF；发送仍然禁用。', downloadActions());
}

function blockedPayload(title: string, summary: string, actions: ChatAction[]): ChatPayload {
  return {
    kind: 'blocked',
    title,
    summary,
    question: null,
    lines: [],
    quote: null,
    actions,
  };
}

function payloadFor(
  doc: RfqDocument,
  kind: ChatPayload['kind'],
  title: string,
  summary: string,
  question: string | null,
  actions: ChatAction[],
): ChatPayload {
  const quote = currentQuote(doc);
  return {
    kind,
    title,
    summary,
    question,
    lines: doc.lines.map((line) => ({
      lineIndex: line.lineIndex,
      status: line.status,
      sku: line.matchedSku,
      amountUsd: line.pricing?.currencyAmount ?? null,
      missingFields: line.missingFields,
      question: line.clarification,
    })),
    quote: quote ? { status: quote.status, totalUsd: quote.currencyTotal, marginPct: quote.marginPct } : null,
    actions,
  };
}

function analysisSummary(doc: RfqDocument): string {
  const counts = {
    priced: doc.lines.filter((line) => ['PRICED', 'APPROVED'].includes(line.status)).length,
    clarify: doc.lines.filter((line) => line.status === 'NEEDS_CLARIFICATION').length,
    noMatch: doc.lines.filter((line) => line.status === 'NO_MATCH').length,
    margin: doc.lines.filter((line) => line.status === 'MARGIN_ALERT').length,
  };
  const quote = currentQuote(doc);
  const total = quote ? `客户金额 $${quote.currencyTotal.toFixed(2)}，毛利 ${quote.marginPct.toFixed(1)}%。` : '当前没有可报价行。';
  return `已处理 ${doc.lines.length} 行：可报价 ${counts.priced}，待澄清 ${counts.clarify}，目录外 ${counts.noMatch}，毛利越界 ${counts.margin}。${total}`;
}

function nextQuestion(doc: RfqDocument): string {
  const clarify = doc.lines.find((line) => line.status === 'NEEDS_CLARIFICATION');
  if (clarify) {
    const fields = clarify.missingFields.filter((field) => field !== 'evidence');
    if (fields.length > 0) {
      return `请补充 ROW ${String(clarify.lineIndex).padStart(2, '0')} 的 ${fields.map(fieldLabel).join('、')}。例如回复“第二行表面处理是镀锌”。`;
    }
  }
  const noMatch = doc.lines.find((line) => line.status === 'NO_MATCH');
  if (noMatch) return `ROW ${String(noMatch.lineIndex).padStart(2, '0')} 在当前目录没有硬匹配；请确认是否更换规格，系统不会用相似 SKU 替代。`;
  const margin = doc.lines.find((line) => line.status === 'MARGIN_ALERT');
  if (margin) return `ROW ${String(margin.lineIndex).padStart(2, '0')} 低于毛利底线；需要到报价审批页填写 override 原因。`;
  const quote = currentQuote(doc);
  if (quote?.status === 'READY_FOR_APPROVAL') return '报价已生成。请到报价审批页核对内部成本和毛利，由审批人点击确认；对话不会替你审批。';
  if (quote?.status === 'APPROVED' || quote?.status === 'EXPORTED') return '报价已审批。可以下载客户 CSV/PDF，发送仍然禁用。';
  return '可以继续问我“为什么第三行不能报价”。';
}

function nextActions(doc: RfqDocument): ChatAction[] {
  const quote = currentQuote(doc);
  const actions: ChatAction[] = [];
  if (quote?.status === 'READY_FOR_APPROVAL') actions.push({ kind: 'approve', label: '去报价审批' });
  if (quote?.status === 'APPROVED' || quote?.status === 'EXPORTED') actions.push(...downloadActions());
  actions.push(openReviewAction());
  return actions;
}

function openReviewAction(): ChatAction {
  return { kind: 'open_review', label: '去审单工作台' };
}

function downloadActions(): ChatAction[] {
  return [
    { kind: 'download', label: '下载 CSV', format: 'csv' },
    { kind: 'download', label: '下载 PDF', format: 'pdf' },
  ];
}

function currentQuote(doc: RfqDocument): Quote | null {
  return doc.quotes.find((quote) => quote.id === doc.currentQuoteId) ?? null;
}

function appendUserTurn(doc: RfqDocument, text: string): RfqDocument {
  const at = nowIso();
  const turn: ChatTurn = { id: makeId('turn'), role: 'user', at, text, payload: null };
  return {
    ...doc,
    agentTurns: [...(doc.agentTurns ?? []), turn],
    updatedAt: at,
    audit: [...doc.audit, {
      id: makeId('aud'),
      at,
      type: 'CHAT',
      actor: 'sales',
      message: `对话输入：${text.slice(0, 180)}`,
      inputHash: doc.inputHash,
      detail: { role: 'user' },
    }],
  };
}

function appendAssistantTurn(doc: RfqDocument, payload: ChatPayload, text: string): RfqDocument {
  const at = nowIso();
  const turn: ChatTurn = { id: makeId('turn'), role: 'assistant', at, text, payload };
  return {
    ...doc,
    agentTurns: [...(doc.agentTurns ?? []), turn],
    updatedAt: at,
    audit: [...doc.audit, {
      id: makeId('aud'),
      at,
      type: 'CHAT',
      actor: 'agent:conversation',
      message: `对话回复：${payload.title}`,
      inputHash: doc.inputHash,
      detail: { role: 'assistant', kind: payload.kind },
    }],
  };
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function statusLabel(status: RfqLine['status']): string {
  const labels: Record<RfqLine['status'], string> = {
    READY: '可处理',
    NEEDS_CLARIFICATION: '待澄清',
    NO_MATCH: '目录外',
    PRICED: '可报价',
    MARGIN_ALERT: '毛利越界',
    APPROVED: '已审批',
    REJECTED: '已拒绝',
  };
  return labels[status];
}
