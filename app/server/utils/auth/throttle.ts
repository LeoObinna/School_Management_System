/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * Used to slow down credential stuffing on login. Cloudflare Workers
 * isolates do not share global memory, so this is deliberately labelled
 * best-effort; authoritative rate limiting is provided by the Cloudflare
 * WAF and (later) a KV/Durable Object backed limiter. The sliding-window
 * logic here is isolated and unit-tested so the backing store can change
 * without touching call sites.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly maxAttempts: number,
    private readonly windowSeconds: number,
  ) {}

  /**
   * Records an attempt at `nowMs` and decides whether it is allowed.
   * Pure with respect to injected time (handy for tests).
   */
  check(key: string, nowMs?: number): RateLimitResult {
    const at = nowMs ?? Date.now()
    const windowStart = at - this.windowSeconds * 1000
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > windowStart)

    if (recent.length >= this.maxAttempts) {
      const oldest = recent[0] ?? at
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + this.windowSeconds * 1000 - at) / 1000),
      )
      this.hits.set(key, recent)
      return { allowed: false, remaining: 0, retryAfterSeconds }
    }

    recent.push(at)
    this.hits.set(key, recent)
    return {
      allowed: true,
      remaining: this.maxAttempts - recent.length,
      retryAfterSeconds: 0,
    }
  }

  reset(key?: string): void {
    if (key) {
      this.hits.delete(key)
    } else {
      this.hits.clear()
    }
  }
}

/** 10 login attempts per 5 minutes per ip+email. */
export const loginThrottler = new SlidingWindowLimiter(10, 300)
