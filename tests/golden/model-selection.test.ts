import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  modelIdSchema,
} from '../../shared/models.js';
import { dataCache } from '../../server/data.js';
import { applyExtraction } from '../../server/domain/analyze.js';
import { llmConfigFromEnv, type LlmConfig } from '../../server/llm/client.js';
import { llmForModelId, publicModelOptions } from '../../server/llm/models.js';
import { customer, emptyDocument, fullLine } from './helpers.js';

const baseLlm: LlmConfig = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: 'sk-test-key',
  model: 'deepseek-v4-pro',
  flashModel: 'deepseek-flash',
  timeoutMs: 45_000,
  maxRetries: 0,
};

describe('selectable extraction models', () => {
  it('exposes Flash as the default and V4 Pro as the second demo option', () => {
    expect(DEFAULT_MODEL_ID).toBe('flash');
    expect(publicModelOptions()).toEqual(MODEL_OPTIONS);
    expect(publicModelOptions()).toHaveLength(2);
    expect(publicModelOptions()[0]).toMatchObject({ id: 'flash', label: 'DeepSeek Flash', default: true });
    expect(publicModelOptions()[1]).toMatchObject({ id: 'pro', label: 'DeepSeek V4 Pro' });
  });

  it('accepts only the controlled model ids and defaults to Flash', () => {
    expect(modelIdSchema.optional().parse(undefined)).toBeUndefined();
    expect(modelIdSchema.parse('flash')).toBe('flash');
    expect(modelIdSchema.parse('pro')).toBe('pro');
    expect(modelIdSchema.safeParse('chat').success).toBe(false);
    expect(modelIdSchema.safeParse('deepseek-v4-pro').success).toBe(false);
    expect(llmForModelId(baseLlm).model).toBe('deepseek-flash');
  });

  it('maps selected ids to server-side model names without mutating base config', () => {
    expect(llmForModelId(baseLlm, 'flash').model).toBe('deepseek-flash');
    expect(llmForModelId(baseLlm, 'pro').model).toBe('deepseek-v4-pro');
    expect(baseLlm.model).toBe('deepseek-v4-pro');
  });

  it('reads both selectable models from environment configuration', () => {
    const configured = llmConfigFromEnv({
      DEEPSEEK_API_KEY: 'sk-test-key',
      DEEPSEEK_PRO_MODEL: 'customer-pro-model',
      DEEPSEEK_FLASH_MODEL: 'customer-flash-model',
    });

    expect(llmForModelId(configured, 'flash').model).toBe('customer-flash-model');
    expect(llmForModelId(configured, 'pro').model).toBe('customer-pro-model');
  });

  it('records the selected model while leaving SKU and pricing facts unchanged', () => {
    const deps = {
      customer: customer('CUST-001'),
      catalog: dataCache.catalog,
      rules: dataCache.pricingRules,
    };
    const extraction = {
      lines: [fullLine()],
      engineMode: 'llm' as const,
      engineNote: 'model selected',
    };
    const pro = applyExtraction(
      emptyDocument('CUST-001', fullLine().sourceLine),
      { ...extraction, model: 'deepseek-v4-pro' },
      deps,
    );
    const flash = applyExtraction(
      emptyDocument('CUST-001', fullLine().sourceLine),
      { ...extraction, model: 'deepseek-flash' },
      deps,
    );

    expect(pro.audit.at(-1)?.model).toBe('deepseek-v4-pro');
    expect(flash.audit.at(-1)?.model).toBe('deepseek-flash');
    expect(flash.lines[0].matchedSku).toBe(pro.lines[0].matchedSku);
    expect(flash.lines[0].pricing).toEqual(pro.lines[0].pricing);
    expect(flash.quotes[0].currencyTotal).toBe(pro.quotes[0].currencyTotal);
    expect(flash.quotes[0].marginPct).toBe(pro.quotes[0].marginPct);
  });
});
