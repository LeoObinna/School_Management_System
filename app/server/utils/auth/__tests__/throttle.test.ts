import { describe, it, expect, beforeEach } from 'vitest'
import { SlidingWindowLimiter } from '../throttle'

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter
  const t0 = 1_000_000_000_000

  beforeEach(() => {
    limiter = new SlidingWindowLimiter(3, 60) // 3 attempts / 60s
  })

  it('allows attempts up to the limit', () => {
    expect(limiter.check('k', t0).allowed).toBe(true)
    expect(limiter.check('k', t0 + 1_000).allowed).toBe(true)
    expect(limiter.check('k', t0 + 2_000).allowed).toBe(true)
  })

  it('blocks once the limit is exceeded and reports retry time', () => {
    limiter.check('k', t0)
    limiter.check('k', t0 + 1_000)
    limiter.check('k', t0 + 2_000)
    const result = limiter.check('k', t0 + 3_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    // Oldest hit at t0 slides out at t0+60s.
    expect(result.retryAfterSeconds).toBe(57)
  })

  it('allows again after the window slides', () => {
    limiter.check('k', t0)
    limiter.check('k', t0 + 1_000)
    limiter.check('k', t0 + 2_000)
    expect(limiter.check('k', t0 + 3_000).allowed).toBe(false)
    // 61s after the oldest hit — it has slid out of the window.
    expect(limiter.check('k', t0 + 61_000).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    limiter.check('a', t0)
    limiter.check('a', t0)
    expect(limiter.check('b', t0).allowed).toBe(true)
  })

  it('reset clears the counter', () => {
    limiter.check('k', t0)
    limiter.check('k', t0)
    limiter.check('k', t0)
    expect(limiter.check('k', t0).allowed).toBe(false)
    limiter.reset('k')
    expect(limiter.check('k', t0).allowed).toBe(true)
  })
})
