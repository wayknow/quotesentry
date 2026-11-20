import type { ExtractedLine } from './extraction.js';
import { standardGroup } from './standards.js';

export interface GateResult {
  ready: boolean;
  missingFields: string[];
  conflicts: string[];
}

export const REQUIRED_FIELDS = [
  'productType',
  'standard',
  'diameterMm',
  'lengthMm',
  'material',
  'strengthGrade',
  'surfaceTreatment',
  'quantity',
  'unit',
] as const;

export const FIELD_LABELS: Record<string, string> = {
  productType: '产品类型',
  standard: '标准',
  diameterMm: '公称直径',
  lengthMm: '长度',
  threadPitchMm: '螺距',
  material: '材质',
  strengthGrade: '强度等级',
  surfaceTreatment: '表面处理',
  quantity: '数量',
  unit: '单位',
  evidence: '原文证据',
};

export function evaluateGate(line: ExtractedLine): GateResult {
  const missingFields: string[] = [];
  const conflicts: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (line[field] === null || line[field] === undefined || line[field] === '') {
      missingFields.push(field);
    }
  }

  if (!line.sourceLine.trim() || !line.evidenceVerified) {
    missingFields.push('evidence');
  }

  if (line.standard && !standardGroup(line.standard)) {
    conflicts.push(`无法识别标准 ${line.standard}；当前只支持 DIN 933/931、ISO 4017/4014、GB/T 5783/5782。`);
  }

  if (line.unit && line.unit !== 'pcs') {
    conflicts.push(`单位 ${line.unit} 不能直接计价；请客户按 pcs 提供数量，系统不会猜测箱规或套件换算。`);
  }

  if (line.quantity !== null && (!Number.isFinite(line.quantity) || line.quantity <= 0)) {
    conflicts.push('数量必须大于 0。');
  }

  for (const [field, value] of [
    ['diameterMm', line.diameterMm],
    ['lengthMm', line.lengthMm],
    ['threadPitchMm', line.threadPitchMm],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      conflicts.push(`${FIELD_LABELS[field]}必须是大于 0 的数字。`);
    }
  }

  return {
    ready: missingFields.length === 0 && conflicts.length === 0,
    missingFields: [...new Set(missingFields)],
    conflicts: [...new Set(conflicts)],
  };
}
