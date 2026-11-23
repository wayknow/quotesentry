import type { Env } from './env.js';
import { json } from './http.js';

const CHALLENGE = 'Basic realm="QuoteSentry", charset="UTF-8"';

export async function enforceBasicAuth(request: Request, env: Env): Promise<Response | null> {
  const user = (env.BASIC_AUTH_USER || '').trim();
  const password = env.BASIC_AUTH_PASSWORD || '';

  if (!user && !password) return null;
  if (!user || !password) {
    return json({
      error: 'BASIC_AUTH_USER 和 BASIC_AUTH_PASSWORD 必须同时配置，或同时留空。',
      code: 'AUTH_CONFIG_INVALID',
    }, 500);
  }

  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.trim().match(/^Basic\s+(.+)$/i);
  if (!match) return challenge();

  let decoded = '';
  try {
    const binary = atob(match[1]);
    decoded = new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    return challenge();
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) return challenge();

  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);
  const [userOk, passwordOk] = await Promise.all([
    secureEqual(suppliedUser, user),
    secureEqual(suppliedPassword, password),
  ]);

  return userOk && passwordOk ? null : challenge();
}

function challenge(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': CHALLENGE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}
