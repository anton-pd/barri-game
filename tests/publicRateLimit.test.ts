import { afterEach, describe, expect, it } from 'vitest';
import {
  consumeRateLimit, enforceRateLimit, getClientIp, resetRateLimitsForTests,
} from '@/lib/publicRateLimit';

afterEach(() => {
  resetRateLimitsForTests();
  delete process.env.TRUST_PROXY_HEADERS;
});

describe('public abuse limiter', () => {
  it('does not trust forwarded IPs unless explicitly configured', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    expect(getClientIp(request)).toBe('untrusted-proxy');
    process.env.TRUST_PROXY_HEADERS = 'true';
    expect(getClientIp(request)).toBe('203.0.113.10');
  });

  it('blocks after the bound and returns a retry interval', () => {
    expect(consumeRateLimit('demo', 'ip:a', { limit: 2, windowMs: 60_000 }, 0).allowed).toBe(true);
    expect(consumeRateLimit('demo', 'ip:a', { limit: 2, windowMs: 60_000 }, 1).allowed).toBe(true);
    const blocked = consumeRateLimit('demo', 'ip:a', { limit: 2, windowMs: 60_000 }, 2);
    expect(blocked).toMatchObject({ allowed: false, retryAfter: 60 });
  });

  it('emits 429 with Retry-After', async () => {
    const request = new Request('https://example.test');
    expect(enforceRateLimit(request, 'login', { limit: 1, windowMs: 60_000 })).toBeNull();
    const response = enforceRateLimit(request, 'login', { limit: 1, windowMs: 60_000 });
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('60');
  });

  it('keeps an identity budget global when the caller changes IP address', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const firstIp = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    const secondIp = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });

    expect(
      enforceRateLimit(firstIp, 'login-identity', { limit: 1, windowMs: 60_000 }, 'person@example.test'),
    ).toBeNull();
    expect(
      enforceRateLimit(secondIp, 'login-identity', { limit: 1, windowMs: 60_000 }, 'person@example.test')?.status,
    ).toBe(429);
  });
});
