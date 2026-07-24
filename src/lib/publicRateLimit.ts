import crypto from 'crypto';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return 'untrusted-proxy';
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  const value = forwarded || real;
  return value && value.length <= 64 ? value : 'unknown';
}

function opaque(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function consumeRateLimit(
  scope: string,
  identity: string,
  rule: RateLimitRule,
  now = Date.now(),
): { allowed: boolean; retryAfter: number; remaining: number } {
  const key = `${scope}:${opaque(identity)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
  }
  bucket.count += 1;
  buckets.delete(key);
  buckets.set(key, bucket);

  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }

  return {
    allowed: bucket.count <= rule.limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    remaining: Math.max(0, rule.limit - bucket.count),
  };
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  rule: RateLimitRule,
  identity?: string,
): Response | null {
  const ip = getClientIp(request);
  const result = consumeRateLimit(scope, `${ip}:${identity ?? ''}`, rule);
  if (result.allowed) return null;
  return Response.json(
    { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  );
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
