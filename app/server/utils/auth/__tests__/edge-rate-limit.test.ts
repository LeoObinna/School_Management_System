import { describe, it, expect, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  checkRateLimit,
  clearRateLimit,
  evaluateWindow,
  RATE_LIMIT_RULES,
} from '../throttle'
import type { EdgeKv } from '../edge-kv'

interface Stored {
  value: string
  ttl: number
}

class FakeKv implements EdgeKv {
  readonly store = new Map<string, Stored>()

  async get(key: string, options?: { type?: string }): Promise<unknown> {
    const item = this.store.get(key)
    if (!item) return null
    return options?.type === 'json' ? JSON.parse(item.value) : item.value
  }

  async put(key: string, value: string, options?: {
    expirationTtl?: number
  }): Promise<void> {
    this.store.set(key, { value, ttl: options?.expirationTtl ?? 0 })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }
}

class ThrowingKv implements EdgeKv {
  async get(): Promise<unknown> {
    throw new Error('kv unavailable')
  }
  async put(): Promise<void> {
    throw new Error('kv unavailable')
  }
  async delete(): Promise<void> {
    throw new Error('kv unavailable')
  }
}

function eventWith(kv: EdgeKv | null): H3Event {
  return {
    context: {
      cloudflare: kv ? { env: { EDGE_KV: kv } } : { env: {} },
    },
  } as unknown as H3Event
}

describe('evaluateWindow (pure)', () => {
  const rule = { maxAttempts: 3, windowSeconds: 60 }
  const t0 = 1_000_000_000_000

  it('records hits and reports remaining', () => {
    const r = evaluateWindow([], rule, t0)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
    expect(r.recent).toEqual([t0])
  })

  it('prunes hits older than the window', () => {
    const r = evaluateWindow([t0 - 61_000, t0 - 1_000], rule, t0)
    // Expired hit dropped; surviving hit kept; current attempt recorded.
    expect(r.recent).toEqual([t0 - 1_000, t0])
    expect(r.allowed).toBe(true)
  })

  it('blocks a full window with a numeric retry delta', () => {
    const r = evaluateWindow([t0, t0 + 1_000, t0 + 2_000], rule, t0 + 3_000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfterSeconds).toBe(57)
  })
})

describe('checkRateLimit with EDGE_KV', () => {
  const t0 = 1_000_000_000_000

  it('shares counters via KV and blocks at the login limit', async () => {
    const kv = new FakeKv()
    const rule = RATE_LIMIT_RULES.login
    for (let i = 0; i < rule.maxAttempts; i += 1) {
      const r = await checkRateLimit(eventWith(kv), 'login', '1.2.3.4:a@b.co', t0 + i * 1000)
      expect(r.allowed).toBe(true)
    }
    const blocked = await checkRateLimit(
      eventWith(kv),
      'login',
      '1.2.3.4:a@b.co',
      t0 + rule.maxAttempts * 1000,
    )
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)

    // Counter lives in KV (key format) with a window-length TTL.
    const item = kv.store.get('rl:login:1.2.3.4:a@b.co')
    expect(item).toBeDefined()
    expect(item?.ttl).toBe(rule.windowSeconds)
  })

  it('tracks identity keys independently', async () => {
    const kv = new FakeKv()
    const a = await checkRateLimit(eventWith(kv), 'login', 'ip1:a@b.co', t0)
    const b = await checkRateLimit(eventWith(kv), 'login', 'ip2:a@b.co', t0)
    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)
    expect(kv.store.size).toBe(2)
  })

  it('clearRateLimit removes the KV counter', async () => {
    const kv = new FakeKv()
    await checkRateLimit(eventWith(kv), 'login', 'ip:a@b.co', t0)
    expect(kv.store.has('rl:login:ip:a@b.co')).toBe(true)
    await clearRateLimit(eventWith(kv), 'login', 'ip:a@b.co')
    expect(kv.store.has('rl:login:ip:a@b.co')).toBe(false)
  })

  it('fails open to in-memory limiting when KV throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const kv = new ThrowingKv()
    const r = await checkRateLimit(eventWith(kv), 'login', 'ip:a@b.co', t0)
    expect(r.allowed).toBe(true)
    spy.mockRestore()
  })

  it('uses in-memory limiting when no KV binding exists', async () => {
    const r1 = await checkRateLimit(eventWith(null), 'login', 'ip:a@b.co', t0)
    const r2 = await checkRateLimit(eventWith(null), 'login', 'ip:a@b.co', t0)
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
  })
})
