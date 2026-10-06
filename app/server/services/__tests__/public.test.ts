/**
 * Phase 18A public website service tests.
 *
 * The DB layer is mocked: each count query resolves from a FIFO queue in
 * the fixed query order (students, teachers, classes, subjects), so we
 * assert the aggregation/mapping and the KV cache hit/miss behavior
 * without a live D1/Workers runtime.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { EdgeKv } from '../../utils/auth/edge-kv'

// FIFO queue of count results, one per query the service issues.
let countQueue: number[] = []

vi.mock('../../utils/db', () => {
  const client = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          const n = countQueue.shift() ?? 0
          return Promise.resolve([{ n }])
        }),
      })),
    })),
  }
  return { db: client, databaseFor: () => client }
})

class FakeKv implements EdgeKv {
  readonly store = new Map<string, { value: string; ttl: number }>()

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
    this.store.set(key, { value, ttl: options?.expirationTtl ?? 0 })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }
}

function eventWith(kv: EdgeKv | null): H3Event {
  return {
    context: {
      cloudflare: kv ? { env: { EDGE_KV: kv } } : { env: {} },
    },
  } as unknown as H3Event
}

import { getPublicStats } from '../public'

describe('public stats service (Phase 18A)', () => {
  beforeEach(() => {
    countQueue = []
  })

  it('maps the four aggregate counts in query order', async () => {
    countQueue = [120, 14, 10, 18]
    const stats = await getPublicStats(eventWith(null))
    expect(stats).toEqual({
      students: 120,
      teachers: 14,
      classes: 10,
      subjects: 18,
    })
  })

  it('returns zeros when the tables are empty', async () => {
    countQueue = []
    const stats = await getPublicStats(eventWith(null))
    expect(stats).toEqual({ students: 0, teachers: 0, classes: 0, subjects: 0 })
  })

  it('caches the aggregate in KV for five minutes', async () => {
    const kv = new FakeKv()
    countQueue = [50, 8, 6, 12]

    const first = await getPublicStats(eventWith(kv))
    expect(first.students).toBe(50)
    const cached = kv.store.get('cache:public:stats')
    expect(cached).toBeDefined()
    expect(cached?.ttl).toBe(300)

    // Mutate the queue; a cached read must NOT issue new queries.
    countQueue = [999, 999, 999, 999]
    const second = await getPublicStats(eventWith(kv))
    expect(second.students).toBe(50)
    expect(countQueue.length).toBe(4) // untouched
  })
})
