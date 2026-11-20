import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export const config = {
  root,
  port: Number(process.env.PORT || 3001),
  appMode: (process.env.APP_MODE || 'demo') as 'demo' | 'production',
  sendMode: process.env.SEND_MODE || 'disabled',
  dbPath: path.resolve(root, process.env.DB_PATH || 'data/db.json'),
  dataDir: path.resolve(root, 'data'),
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || 'deepseek-chat',
    timeoutMs: positiveNumber(process.env.DEEPSEEK_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS, 45000),
    maxRetries: nonNegativeInteger(process.env.DEEPSEEK_MAX_RETRIES || process.env.LLM_MAX_RETRIES, 1),
  },
};

export function hasLlmKey(): boolean {
  return Boolean(config.llm.apiKey.trim());
}
