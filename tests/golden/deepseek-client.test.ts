import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../server/config.js';
import { callDeepSeekJson } from '../../server/llm/client.js';

const originalLlmConfig = { ...config.llm };

afterEach(() => {
  Object.assign(config.llm, originalLlmConfig);
  vi.unstubAllGlobals();
});

describe('DeepSeek server-side request contract', () => {
  it('calls the same direct OpenAI-compatible endpoint with a server-side bearer key', async () => {
    config.llm.apiKey = 'sk-test-key';
    config.llm.baseUrl = 'https://api.deepseek.com';
    config.llm.model = 'deepseek-chat';
    config.llm.maxRetries = 0;

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      new Response(JSON.stringify({ choices: [{ message: { content: '{"lines":[]}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callDeepSeekJson('Extract this RFQ', config.llm)).resolves.toEqual({ lines: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-key');

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'deepseek-chat',
      stream: false,
      response_format: { type: 'json_object' },
    });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Extract this RFQ' });
  });
});
