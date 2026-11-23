import { describe, expect, it } from 'vitest';
import { enforceBasicAuth } from '../../worker/auth.js';
import type { Env } from '../../worker/env.js';

function env(overrides: Partial<Env> = {}): Env {
  return overrides as Env;
}

function basic(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

describe('Worker Basic Auth', () => {
  it('stays disabled when both credentials are blank', async () => {
    await expect(enforceBasicAuth(new Request('https://example.com/api/health'), env()))
      .resolves.toBeNull();
  });

  it('challenges missing or incorrect credentials', async () => {
    const request = new Request('https://example.com/api/health', {
      headers: { Authorization: basic('demo', 'wrong') },
    });
    const response = await enforceBasicAuth(request, env({
      BASIC_AUTH_USER: 'demo',
      BASIC_AUTH_PASSWORD: 'secret',
    }));
    expect(response?.status).toBe(401);
    expect(response?.headers.get('WWW-Authenticate')).toContain('Basic');
  });

  it('accepts the configured credentials', async () => {
    const request = new Request('https://example.com/api/health', {
      headers: { Authorization: basic('demo', 'secret') },
    });
    await expect(enforceBasicAuth(request, env({
      BASIC_AUTH_USER: 'demo',
      BASIC_AUTH_PASSWORD: 'secret',
    }))).resolves.toBeNull();
  });

  it('fails closed when only one credential is configured', async () => {
    const response = await enforceBasicAuth(
      new Request('https://example.com/api/health'),
      env({ BASIC_AUTH_USER: 'demo' }),
    );
    expect(response?.status).toBe(500);
  });
});

