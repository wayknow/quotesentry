import { z } from 'zod';

export const MODEL_IDS = ['flash', 'pro'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const DEFAULT_MODEL_ID: ModelId = 'flash';
export const modelIdSchema = z.enum(MODEL_IDS);

export interface ModelOption {
  id: ModelId;
  label: string;
  description: string;
  default?: boolean;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: 'flash',
    label: 'DeepSeek Flash',
    description: '默认 · 低延迟字段抽取',
    default: true,
  },
  {
    id: 'pro',
    label: 'DeepSeek V4 Pro',
    description: '更强推理 · 适合复杂询价',
  },
];

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && (MODEL_IDS as readonly string[]).includes(value);
}

export function modelLabel(modelId: ModelId): string {
  return MODEL_OPTIONS.find((option) => option.id === modelId)?.label ?? modelId;
}
