import type { DocumentStatus, LineStatus, QuoteStatus } from '../../shared/schema.js';

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  RECEIVED: '待分析',
  EXTRACTING: '抽取中',
  NEEDS_REVIEW: '部分待处理',
  PRICED: '已计价',
  READY_FOR_APPROVAL: '待审批',
  APPROVED: '已审批',
  EXPORTED: '已导出',
  FAILED: '未识别',
};

export const LINE_STATUS_LABEL: Record<LineStatus, string> = {
  READY: '可处理',
  NEEDS_CLARIFICATION: '待澄清',
  NO_MATCH: '目录外',
  PRICED: '可报价',
  MARGIN_ALERT: '毛利越界',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: '草稿',
  READY_FOR_APPROVAL: '待审批',
  APPROVED: '已审批',
  EXPORTED: '已导出',
};

export const FIELD_LABEL: Record<string, string> = {
  productType: '产品类型',
  standard: '标准',
  diameterMm: '直径',
  lengthMm: '长度',
  threadPitchMm: '螺距',
  material: '材质',
  strengthGrade: '强度',
  surfaceTreatment: '表面',
  quantity: '数量',
  unit: '单位',
  evidence: '原文证据',
};

export function statusTone(status: DocumentStatus | LineStatus | QuoteStatus): string {
  if (['APPROVED', 'PRICED', 'READY'].includes(status)) return 'ok';
  if (['READY_FOR_APPROVAL', 'RECEIVED', 'EXTRACTING', 'DRAFT'].includes(status)) return 'info';
  if (['MARGIN_ALERT', 'NEEDS_REVIEW'].includes(status)) return 'warn';
  if (['NO_MATCH', 'FAILED', 'REJECTED'].includes(status)) return 'danger';
  return 'neutral';
}

export function materialLabel(value: string | null): string {
  if (!value) return '未提供';
  if (value === 'carbon_steel') return '碳钢';
  if (value === 'SS304') return 'SS304 / A2';
  if (value === 'SS316') return 'SS316 / A4';
  return value;
}

export function surfaceLabel(value: string | null): string {
  if (!value) return '未提供';
  if (value === 'zinc') return '镀锌';
  if (value === 'hdg') return '热镀锌';
  if (value === 'plain') return '本色';
  return value;
}

export function productLabel(value: string | null): string {
  if (!value) return '未提供';
  if (value === 'hex_bolt') return '六角螺栓';
  if (value === 'screw') return '螺钉';
  if (value === 'hex_nut') return '六角螺母';
  if (value === 'washer') return '垫圈';
  return value;
}

export function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCny(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}¥${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function dimensionLabel(line: {
  diameterMm: number | null;
  lengthMm: number | null;
  threadPitchMm: number | null;
}): string {
  if (line.diameterMm === null && line.lengthMm === null) return '尺寸未提供';
  const base = `M${line.diameterMm ?? '?'} × ${line.lengthMm ?? '?'}`;
  return line.threadPitchMm === null ? base : `${base} P${line.threadPitchMm}`;
}
