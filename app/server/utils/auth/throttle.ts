/**
 * Rate limiting for credential endpoints.
 *
 * Two backing stores, same sliding-window semantics:
 *
 *  - Cloudflare KV (`EDGE_KV`) in deployed Workers and under
 *    `wrangler dev`: counters are shared across isolates, so throttling
 *    is authoritative at the application layer.
 *  - In-memory per isolate in plain Node dev (`nuxt dev`) and as a
 *    fail-open fallback if KV is temporarily unavailable: best-effort,
 *    exactly like the pre-Phase-13 limiter.
 *
 * The Cloudflare WAF remains the outer, authoritative throttle; this
 * module provides per-identity (ip+email) application limiting with the
 * correct 429 + Retry-After contract.
 */
import type { H3Event } from 'h3'
import { getEdgeKv, type EdgeKv } from './edge-kv'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export interface RateLimitRule {
  maxAttempts: number
  windowSeconds: number
}

/** Scope → policy. Window must be >= 60s (KV minimum expirationTtl). */
export const RATE_LIMIT_RULES = {
  login: { maxAttempts: 10, windowSeconds: 300 }, // 10 / 5 min
  'forgot-password': { maxAttempts: 5, windowSeconds: 900 }, // 5 / 15 min
} as const satisfies Record<string, RateLimitRule>

export type RateLimitScope = keyof typeof RATE_LIMIT_RULES

/**
 * Pure sliding-window decision. Filters expired hits, rejects when the
 * window is full, otherwise records `nowMs`. Injected time keeps this
 * deterministic for tests.
 */
export function evaluateWindow(
  timestamps: readonly number[],
  rule: RateLimitRule,
  nowMs: number,
): RateLimitResult & { recent: number[] } {
  const windowStart = nowMs - rule.windowSeconds * 1000
  const recent = timestamps.filter((ts) => ts > windowStart)

  if (recent.length >= rule.maxAttempts) {
    const oldest = recent[0] ?? nowMs
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + rule.windowSeconds * 1000 - nowMs) / 1000),
    )
    return { allowed: false, remaining: 0, retryAfterSeconds, recent }
  }

  recent.push(nowMs)
  return {
    allowed: true,
    remaining: rule.maxAttempts - recent.length,
    retryAfterSeconds: 0,
    recent,
  }
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly maxAttempts: number,
    private readonly windowSeconds: number,
  ) {}

  /** Records an attempt and decides whether it is allowed. */
  check(key: string, nowMs?: number): RateLimitResult {
    const { allowed, remaining, retryAfterSeconds, recent } = evaluateWindow(
      this.hits.get(key) ?? [],
      { maxAttempts: this.maxAttempts, windowSeconds: this.windowSeconds },
      nowMs ?? Date.now(),
    )
    this.hits.set(key, recent)
    return { allowed, remaining, retryAfterSeconds }
  }

  reset(key?: string): void {
    if (key) {
      this.hits.delete(key)
    } else {
      this.hits.clear()
    }
  }
}

/** @deprecated use checkRateLimit; kept for existing tests/call sites. */
export const loginThrottler = new SlidingWindowLimiter(
  RATE_LIMIT_RULES.login.maxAttempts,
  RATE_LIMIT_RULES.login.windowSeconds,
)

/** In-memory fallback limiters, one per scope. */
const memoryLimiters: Record<RateLimitScope, SlidingWindowLimiter> = {
  login: loginThrottler,
  'forgot-password': new SlidingWindowLimiter(
    RATE_LIMIT_RULES['forgot-password'].maxAttempts,
    RATE_LIMIT_RULES['forgot-password'].windowSeconds,
  ),
}

function kvKey(scope: RateLimitScope, identityKey: string): string {
  return `rl:${scope}:${identityKey}`
}

/**
 * KV-backed check. Counters are JSON timestamp arrays with an
 * expirationTtl equal to the window, so stale keys self-delete. KV is
 * eventually consistent; a write that is briefly invisible only makes
 * enforcement marginally more permissive, never more strict.
 */
async function checkKv(
  kv: EdgeKv,
  fullKey: string,
  rule: RateLimitRule,
  nowMs: number,
): Promise<RateLimitResult> {
  const raw = await kv.get(fullKey, { type: 'json' })
  const timestamps = Array.isArray(raw)
    ? (raw.filter((v): v is number => typeof v === 'number'))
    : []

  const result = evaluateWindow(timestamps, rule, nowMs)
  await kv.put(fullKey, JSON.stringify(result.recent), {
    expirationTtl: rule.windowSeconds,
  })
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSeconds: result.retryAfterSeconds,
  }
}

/**
 * Applies the scope's sliding-window rule to `identityKey` (normally
 * `ip:email` for login, `ip` for forgot-password). Uses shared KV when
 * bound; otherwise falls back to per-isolate memory. Fails OPEN if KV
 * throws (the outer WAF and in-memory limiter still apply).
 */
export async function checkRateLimit(
  event: H3Event,
  scope: RateLimitScope,
  identityKey: string,
  nowMs?: number,
): Promise<RateLimitResult> {
  const rule = RATE_LIMIT_RULES[scope]
  const at = nowMs ?? Date.now()
  const kv = getEdgeKv(event)

  if (kv) {
    try {
      return await checkKv(kv, kvKey(scope, identityKey), rule, at)
    } catch (error) {
      console.error(`[rate-limit] KV check failed for ${scope}:`, error)
    }
  }
  return memoryLimiters[scope].check(identityKey, at)
}

/** Clears a counter after a successful credential check (login only). */
export async function clearRateLimit(
  event: H3Event,
  scope: RateLimitScope,
  identityKey: string,
): Promise<void> {
  memoryLimiters[scope].reset(identityKey)
  const kv = getEdgeKv(event)
  if (kv) {
    try {
      await kv.delete(kvKey(scope, identityKey))
    } catch (error) {
      console.error(`[rate-limit] KV delete failed for ${scope}:`, error)
    }
  }
}
