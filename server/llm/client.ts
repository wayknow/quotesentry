export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  timeoutMs: 45_000,
  maxRetries: 1,
};

export function llmConfigFromEnv(
  env: Record<string, string | undefined>,
): LlmConfig {
  return {
    baseUrl: (env.DEEPSEEK_BASE_URL || env.LLM_BASE_URL || DEFAULT_LLM_CONFIG.baseUrl).replace(/\/$/, ''),
    apiKey: env.DEEPSEEK_API_KEY || env.LLM_API_KEY || '',
    model: env.DEEPSEEK_MODEL || env.LLM_MODEL || DEFAULT_LLM_CONFIG.model,
    timeoutMs: positiveNumber(
      env.DEEPSEEK_TIMEOUT_MS || env.LLM_TIMEOUT_MS,
      DEFAULT_LLM_CONFIG.timeoutMs,
    ),
    maxRetries: nonNegativeInteger(
      env.DEEPSEEK_MAX_RETRIES || env.LLM_MAX_RETRIES,
      DEFAULT_LLM_CONFIG.maxRetries,
    ),
  };
}

export function hasLlmKey(config?: LlmConfig): boolean {
  return Boolean(config?.apiKey.trim());
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

class LlmRequestError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmRequestError';
  }
}

export async function callDeepSeekJson(prompt: string, llm: LlmConfig): Promise<unknown> {
  if (!hasLlmKey(llm)) {
    throw new Error('DEEPSEEK_API_KEY 未配置，无法调用 DeepSeek。');
  }

  let lastError: Error | null = null;
  const attempts = Math.max(0, llm.maxRetries) + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const content = await requestCompletion(prompt, llm);
      return parseJsonContent(content);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable = error instanceof LlmRequestError ? error.retryable : false;
      if (!retryable || attempt === attempts - 1) break;
      await sleep(500 * (attempt + 1));
    }
  }

  throw new Error(`DeepSeek 调用失败：${lastError?.message ?? '未知错误'}`);
}

async function requestCompletion(prompt: string, llm: LlmConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llm.timeoutMs);

  try {
    const response = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.1,
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a precise RFQ data extraction service. Return one JSON object only. Never calculate or return prices, costs, margins, SKUs, discounts, or exchange rates.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = redact(await safeReadBody(response));
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new LlmRequestError(`HTTP ${response.status}${body ? ` · ${body}` : ''}`, retryable);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new LlmRequestError(payload.error?.message || '模型没有返回 message.content', true);
    }
    return content;
  } catch (error) {
    if (error instanceof LlmRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmRequestError(`请求超时（${llm.timeoutMs}ms）`, true);
    }
    throw new LlmRequestError(`网络请求失败：${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonContent(content: string): unknown {
  let text = content.trim().replace(/^\uFEFF/, '');
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new LlmRequestError('模型返回内容不是合法 JSON', true);
  }
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '';
  }
}

function redact(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
