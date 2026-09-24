/**
 * Tests for the KV read-through cache utility (Phase 12).
 *
 * Mirrors the FakeKv/ThrowingKv pattern from the auth edge-rate-limit
 * tests so the cache helpers run in plain Node without a Workers
 * runtime. Helpers under test: cacheKey, getOrSet, invalidate,
 * invalidateMany.
 */
import { describe, it, expect, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  cacheKey,
  getOrSet,
  invalidate,
  invalidateMany,
  CACHE_PREFIX,
} from '../cache'
import type { EdgeKv } from '../auth/edge-kv'

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

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    this.store.set(key, {
      value,
      ttl: options?.expirationTtl ?? 0,
    })
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

describe('cacheKey', () => {
  it('prefixes and joins parts with a colon', () => {
    expect(cacheKey('school', 'settings')).toBe('cache:school:settings')
    expect(cacheKey('school')).toBe('cache:school')
  })

  it('uses the documented namespace prefix', () => {
    expect(cacheKey('x')).toBe(CACHE_PREFIX + 'x')
  })
})

describe('getOrSet', () => {
  it('returns the cached value without calling the loader', async () => {
    const kv = new FakeKv()
    kv.store.set('cache:thing', {
      value: JSON.stringify({ name: 'cached' }),
      ttl: 60,
    })
    const loader = vi.fn(async () => ({ name: 'fresh' }))
    const result = await getOrSet(
      eventWith(kv),
      'cache:thing',
      60,
      loader,
    )
    expect(result).toEqual({ name: 'cached' })
    expect(loader).not.toHaveBeenCalled()
  })

  it('calls the loader on a miss and persists the value', async () => {
    const kv = new FakeKv()
    const loader = vi.fn(async () => ({ count: 7 }))
    const result = await getOrSet(
      eventWith(kv),
      'cache:thing',
      60,
      loader,
    )
    expect(result).toEqual({ count: 7 })
    expect(loader).toHaveBeenCalledTimes(1)
    const stored = kv.store.get('cache:thing')
    expect(stored).toBeDefined()
    expect(stored?.ttl).toBe(60)
    expect(JSON.parse(stored!.value)).toEqual({ count: 7 })
  })

  it('clamps the TTL to the KV minimum of 60s', async () => {
    const kv = new FakeKv()
    await getOrSet(eventWith(kv), 'cache:k', 5, async () => 'v')
    expect(kv.store.get('cache:k')?.ttl).toBe(60)
  })

  it('bypasses the cache entirely when no KV binding exists', async () => {
    const loader = vi.fn(async () => 'fresh')
    const result = await getOrSet(eventWith(null), 'cache:k', 60, loader)
    expect(result).toBe('fresh')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('falls through to the loader when KV get throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loader = vi.fn(async () => 'fresh')
    const result = await getOrSet(
      eventWith(new ThrowingKv()),
      'cache:k',
      60,
      loader,
    )
    expect(result).toBe('fresh')
    expect(loader).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('still returns the value when KV put throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loader = vi.fn(async () => 'fresh')
    const result = await getOrSet(
      eventWith(new ThrowingKv()),
      'cache:k',
      60,
      loader,
    )
    expect(result).toBe('fresh')
    spy.mockRestore()
  })

  it('treats a null cached value as a miss and re-loads', async () => {
    const kv = new FakeKv()
    const loader = vi.fn(async () => 42)
    const first = await getOrSet(eventWith(kv), 'cache:k', 60, loader)
    const second = await getOrSet(eventWith(kv), 'cache:k', 60, loader)
    expect(first).toBe(42)
    expect(second).toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('invalidate', () => {
  it('deletes the cached key', async () => {
    const kv = new FakeKv()
    kv.store.set('cache:k', { value: '"v"', ttl: 60 })
    await invalidate(eventWith(kv), 'cache:k')
    expect(kv.store.has('cache:k')).toBe(false)
  })

  it('is a noop when no KV binding exists', async () => {
    await expect(invalidate(eventWith(null), 'cache:k')).resolves.toBeUndefined()
  })

  it('swallows delete errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      invalidate(eventWith(new ThrowingKv()), 'cache:k'),
    ).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

describe('invalidateMany', () => {
  it('deletes every listed key', async () => {
    const kv = new FakeKv()
    kv.store.set('cache:a', { value: '1', ttl: 60 })
    kv.store.set('cache:b', { value: '2', ttl: 60 })
    kv.store.set('cache:c', { value: '3', ttl: 60 })
    await invalidateMany(eventWith(kv), ['cache:a', 'cache:c'])
    expect(kv.store.has('cache:a')).toBe(false)
    expect(kv.store.has('cache:b')).toBe(true)
    expect(kv.store.has('cache:c')).toBe(false)
  })

  it('is a noop for an empty key list', async () => {
    const kv = new FakeKv()
    await invalidateMany(eventWith(kv), [])
    expect(kv.store.size).toBe(0)
  })

  it('is a noop when no KV binding exists', async () => {
    await expect(
      invalidateMany(eventWith(null), ['cache:a', 'cache:b']),
    ).resolves.toBeUndefined()
  })

  it('continues deleting remaining keys when one throws', async () => {
    const kv = new FakeKv()
    kv.store.set('cache:b', { value: '2', ttl: 60 })
    const flaky: EdgeKv = {
      get: async () => null,
      put: async () => undefined,
      delete: async (key: string) => {
        if (key === 'cache:a') throw new Error('transient')
        if (key === 'cache:b') kv.store.delete(key)
      },
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await invalidateMany(eventWith(flaky), ['cache:a', 'cache:b'])
    expect(kv.store.has('cache:b')).toBe(false)
    spy.mockRestore()
  })
})
