import { describe, it, expect, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  isSessionRevoked,
  revokeAllSessions,
  revokeSession,
} from '../revocation'
import { SESSION_TTL_SECONDS } from '../tokens'
import type { EdgeKv } from '../edge-kv'

class FakeKv implements EdgeKv {
  readonly store = new Map<string, string>()
  readonly ttls = new Map<string, number>()

  async get(key: string): Promise<unknown> {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  async put(key: string, value: string, options?: {
    expirationTtl?: number
  }): Promise<void> {
    this.store.set(key, value)
    this.ttls.set(key, options?.expirationTtl ?? 0)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
    this.ttls.delete(key)
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

describe('session revocation (EDGE_KV)', () => {
  it('marks a single session revoked on logout', async () => {
    const kv = new FakeKv()
    await revokeSession(eventWith(kv), 'sess-123')
    expect(kv.store.get('sess:rev:sess-123')).toBe('1')
    // TTL outlives the longest-lived cookie, nothing lingers forever.
    expect(kv.ttls.get('sess:rev:sess-123')).toBe(
      SESSION_TTL_SECONDS.remember,
    )

    const revoked = await isSessionRevoked(eventWith(kv), {
      sid: 'sess-123',
      sub: 'user-1',
      iat: 1000,
    })
    expect(revoked).toBe(true)
  })

  it('accepts a different session for the same user', async () => {
    const kv = new FakeKv()
    await revokeSession(eventWith(kv), 'sess-123')
    const ok = await isSessionRevoked(eventWith(kv), {
      sid: 'sess-456',
      sub: 'user-1',
      iat: 1000,
    })
    expect(ok).toBe(false)
  })

  it('revokes only sessions issued before the not-before marker', async () => {
    const kv = new FakeKv()
    await revokeAllSessions(eventWith(kv), 'user-1', 5000)

    const oldSession = await isSessionRevoked(eventWith(kv), {
      sid: 'old',
      sub: 'user-1',
      iat: 4999,
    })
    const newSession = await isSessionRevoked(eventWith(kv), {
      sid: 'new',
      sub: 'user-1',
      iat: 5000,
    })
    expect(oldSession).toBe(true)
    expect(newSession).toBe(false)
    expect(kv.ttls.get('sess:nb:user-1')).toBe(SESSION_TTL_SECONDS.remember)
  })

  it('does not affect other users when one user is revoked', async () => {
    const kv = new FakeKv()
    await revokeAllSessions(eventWith(kv), 'user-1', 5000)
    const other = await isSessionRevoked(eventWith(kv), {
      sid: 'x',
      sub: 'user-2',
      iat: 1,
    })
    expect(other).toBe(false)
  })

  it('fails closed when the bound KV errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const revoked = await isSessionRevoked(eventWith(new ThrowingKv()), {
      sid: 's',
      sub: 'u',
      iat: 1,
    })
    expect(revoked).toBe(true)
    spy.mockRestore()
  })

  it('is inert (not revoked) when no KV binding exists, e.g. Node dev', async () => {
    const revoked = await isSessionRevoked(eventWith(null), {
      sid: 's',
      sub: 'u',
      iat: 1,
    })
    expect(revoked).toBe(false)
  })
})
