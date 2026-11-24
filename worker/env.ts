import type { D1Database, ExecutionContext, R2Bucket } from './cloudflare.js';

export interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  APP_MODE?: string;
  SEND_MODE?: string;
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_PRO_MODEL?: string;
  DEEPSEEK_FLASH_MODEL?: string;
  DEEPSEEK_TIMEOUT_MS?: string;
  DEEPSEEK_MAX_RETRIES?: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  LLM_PRO_MODEL?: string;
  LLM_FLASH_MODEL?: string;
  LLM_TIMEOUT_MS?: string;
  LLM_MAX_RETRIES?: string;
}

export interface WorkerModule {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}
