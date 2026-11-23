import { ZodError } from 'zod';
import { AppError } from '../server/errors.js';

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status, headers: BASE_HEADERS });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof ZodError) {
    return json({
      error: '请求参数不合法',
      code: 'INVALID_REQUEST',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }, 400);
  }
  if (error instanceof SyntaxError) {
    return json({ error: 'JSON 请求体格式不合法', code: 'INVALID_JSON' }, 400);
  }
  console.error('[QuoteSentry Worker] unhandled error:', error instanceof Error ? error.message : error);
  return json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' }, 500);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_JSON_OBJECT', '请求体必须是 JSON 对象。');
  }
  return body as Record<string, unknown>;
}

