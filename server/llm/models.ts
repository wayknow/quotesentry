import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  type ModelId,
  type ModelOption,
} from '../../shared/models.js';
import type { LlmConfig } from './client.js';

export function publicModelOptions(): ModelOption[] {
  return MODEL_OPTIONS.map((option) => ({ ...option }));
}

export function llmForModelId(llm: LlmConfig, modelId: ModelId = DEFAULT_MODEL_ID): LlmConfig {
  return {
    ...llm,
    model: modelId === 'flash' ? llm.flashModel : llm.model,
  };
}
