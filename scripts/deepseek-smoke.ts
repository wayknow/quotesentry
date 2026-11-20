import { config, hasLlmKey } from '../server/config.js';
import { callDeepSeekJson } from '../server/llm/client.js';

if (!hasLlmKey()) {
  console.error('DEEPSEEK_API_KEY 未配置。请先在 .env 或服务器环境变量中设置后再运行。');
  process.exitCode = 1;
} else {
  const startedAt = Date.now();
  try {
    const result = await callDeepSeekJson('Return exactly one JSON object: {"ok":true}');
    if (!result || typeof result !== 'object' || (result as { ok?: unknown }).ok !== true) {
      throw new Error(`DeepSeek 返回了非预期内容：${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({
      ok: true,
      endpoint: `${config.llm.baseUrl}/chat/completions`,
      model: config.llm.model,
      latencyMs: Date.now() - startedAt,
      result,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
