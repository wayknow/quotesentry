import crypto from 'node:crypto';
import type { RequestHandler } from 'express';

const REALM = 'QuoteSentry';
const CHALLENGE = `Basic realm="${REALM}", charset="UTF-8"`;

export function basicAuth(user: string, password: string): RequestHandler {
  return (req, res, next) => {
    if (!isBasicAuthHeaderValid(req.headers.authorization, user, password)) {
      res.setHeader('WWW-Authenticate', CHALLENGE);
      res.setHeader('Cache-Control', 'no-store');
      res.status(401).type('text/plain').send('Authentication required');
      return;
    }
    next();
  };
}

export function isBasicAuthHeaderValid(
  authorization: string | undefined,
  user: string,
  password: string,
): boolean {
  const match = authorization?.trim().match(/^Basic\s+(.+)$/i);
  if (!match || !user || !password) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return false;
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) return false;

  return (
    secureEqual(decoded.slice(0, separator), user)
    && secureEqual(decoded.slice(separator + 1), password)
  );
}

function secureEqual(left: string, right: string): boolean {
  const leftHash = crypto.createHash('sha256').update(left).digest();
  const rightHash = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}
