import { describe, expect, it, vi } from 'vitest';
import { basicAuth, isBasicAuthHeaderValid } from '../../server/auth.js';

function authorization(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

describe('basic auth', () => {
  it('accepts the configured credentials', () => {
    expect(isBasicAuthHeaderValid(authorization('demo', 'secret'), 'demo', 'secret')).toBe(true);
    expect(isBasicAuthHeaderValid(authorization('demo', 'secret').replace('Basic', 'basic'), 'demo', 'secret')).toBe(true);
  });

  it('rejects the wrong user or password', () => {
    expect(isBasicAuthHeaderValid(authorization('other', 'secret'), 'demo', 'secret')).toBe(false);
    expect(isBasicAuthHeaderValid(authorization('demo', 'wrong'), 'demo', 'secret')).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    expect(isBasicAuthHeaderValid(undefined, 'demo', 'secret')).toBe(false);
    expect(isBasicAuthHeaderValid('Bearer token', 'demo', 'secret')).toBe(false);
    expect(isBasicAuthHeaderValid('Basic not-base64', 'demo', 'secret')).toBe(false);
  });

  it('accepts a password containing a colon', () => {
    expect(isBasicAuthHeaderValid(authorization('demo', 'a:b:c'), 'demo', 'a:b:c')).toBe(true);
  });

  it('sends a challenge without credentials and calls next with valid credentials', () => {
    const next = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    basicAuth('demo', 'secret')({ headers: {} } as never, res as never, next);
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="QuoteSentry", charset="UTF-8"');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    basicAuth('demo', 'secret')(
      { headers: { authorization: authorization('demo', 'secret') } } as never,
      res as never,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
