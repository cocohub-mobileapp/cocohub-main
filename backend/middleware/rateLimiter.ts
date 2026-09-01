/**
 * Rate limiting middleware using express-rate-limit with Redis backing.
 * Issue #631 — Per-user rate limiting
 *
 * Limits (per user when authenticated, per IP when not):
 *  - Auth endpoints      : 5 req / min  per IP (always IP-based)
 *  - Public endpoints    : 30 req / min per IP (always IP-based)
 *  - Read endpoints      : 200 req / min per user (fallback to IP)
 *  - Write endpoints     : 60 req / min per user (fallback to IP)
 *  - Blockchain endpoints: 20 req / min per user (fallback to IP)
 *
 * Headers returned: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * On 429 the response also includes a Retry-After header (seconds until reset).
 * Sustained violations (≥ 3 consecutive 429s from the same key) are logged.
 */

import { type Request, type Response } from 'express';
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

import { type AuthenticatedRequest } from './auth';

// ---------------------------------------------------------------------------
// Redis client (shared with redisSession if desired)
// ---------------------------------------------------------------------------

const redisClient = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on('error', (err: Error) => {
  console.error('[rateLimiter] Redis error:', err.message);
});

// ---------------------------------------------------------------------------
// Violation tracker (in-memory; replace with Redis INCR for multi-instance)
// ---------------------------------------------------------------------------

const violationCounts = new Map<string, number>();
const VIOLATION_ALERT_THRESHOLD = 3;

function trackViolation(key: string): void {
  const count = (violationCounts.get(key) ?? 0) + 1;
  violationCounts.set(key, count);

  if (count >= VIOLATION_ALERT_THRESHOLD) {
    console.warn(
      `[rateLimiter] ALERT: key "${key}" has hit the rate limit ${count} times consecutively`,
    );
  }
}

// ---------------------------------------------------------------------------
// Key generators
// ---------------------------------------------------------------------------

function ipKey(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

/** Use userId for authenticated requests, fall back to IP for unauthenticated. */
function userOrIpKey(req: Request): string {
  const authed = req as AuthenticatedRequest;
  if (authed.user?.id) {
    return `user:${authed.user.id}`;
  }
  return ipKey(req);
}

// ---------------------------------------------------------------------------
// Shared store factory
// ---------------------------------------------------------------------------

function makeStore(prefix: string): RedisStore | undefined {
  if (process.env.NODE_ENV === 'test') {
    return undefined;
  }
  return new RedisStore({
    // @ts-expect-error — ioredis is compatible but types differ slightly
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix,
  });
}

// ---------------------------------------------------------------------------
// Shared options
// ---------------------------------------------------------------------------

const sharedOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: true, // Return X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  skip: (req: Request) => req.path === '/health' || req.path === '/ready',
};

// ---------------------------------------------------------------------------
// Public rate limiter — 30 req / min per IP (unauthenticated traffic)
// ---------------------------------------------------------------------------

export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: ipKey,
  store: makeStore('rl:public:'),
  handler: (_req: Request, res: Response) => {
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: 60,
    });
  },
});

// ---------------------------------------------------------------------------
// Auth rate limiter — 5 req / min per IP (login, register — always IP-based)
// ---------------------------------------------------------------------------

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: ipKey,
  store: makeStore('rl:auth:'),
  handler: (req: Request, res: Response) => {
    trackViolation(`auth:${ipKey(req)}`);
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please wait 1 minute.',
      retryAfter: 60,
    });
  },
});

// ---------------------------------------------------------------------------
// Read rate limiter — 200 req / min per user (fallback to IP)
// ---------------------------------------------------------------------------

export const readRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: userOrIpKey,
  store: makeStore('rl:read:'),
  handler: (req: Request, res: Response) => {
    const key = userOrIpKey(req);
    trackViolation(`read:${key}`);
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Read rate limit exceeded. Please slow down.',
      retryAfter: 60,
    });
  },
});

// ---------------------------------------------------------------------------
// Write rate limiter — 60 req / min per user (fallback to IP)
// ---------------------------------------------------------------------------

export const writeRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  store: makeStore('rl:write:'),
  handler: (req: Request, res: Response) => {
    const key = userOrIpKey(req);
    trackViolation(`write:${key}`);
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Write rate limit exceeded. Please slow down.',
      retryAfter: 60,
    });
  },
});

// ---------------------------------------------------------------------------
// Blockchain rate limiter — 20 req / min per user (fallback to IP)
// ---------------------------------------------------------------------------

export const blockchainRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  store: makeStore('rl:blockchain:'),
  handler: (req: Request, res: Response) => {
    const key = userOrIpKey(req);
    trackViolation(`blockchain:${key}`);
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Blockchain rate limit exceeded. Please slow down.',
      retryAfter: 60,
    });
  },
});

// ---------------------------------------------------------------------------
// Legacy alias — kept for backward compatibility with existing route mounts
// ---------------------------------------------------------------------------

/** @deprecated Use readRateLimiter or writeRateLimiter instead */
export const dataRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: userOrIpKey,
  store: makeStore('rl:data:'),
  handler: (req: Request, res: Response) => {
    const key = userOrIpKey(req);
    trackViolation(`data:${key}`);
    res.setHeader('Retry-After', 60);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: 60,
    });
  },
});
