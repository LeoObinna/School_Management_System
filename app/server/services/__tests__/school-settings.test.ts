/**
 * Phase 14A school settings service tests (Phase 12 KV caching added).
 *
 * The DB layer is mocked so we assert key/value mapping, defaults,
 * coercion, the public subset, and the KV cache hit/miss/invalidate
 * paths without a live D1/Workers runtime. The EDGE_KV binding is
 * driven through a FakeKv so the cache wiring is exercised directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { EdgeKv } from '../../utils/auth/edge-kv'

let storedRows: { key: string; value: string | null }[] = []
const inserted: { key: string; value: string }[] = []
const updated: { key: string; value: string }[] = []

vi.mock('../../utils/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(storedRows)),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockImplementation(({ target, set }: { target: unknown; set: { value: string } }) => {
      // Simulate upsert: if key exists, update value; else insert.
      // We capture insert values separately because mockReturnThis chains.
      return Promise.resolve([{ id: 'x' }])
    }),
  },
}))

// The db.insert(...).values(...) chain needs to capture the values. Patch
// the chain methods to record arguments.
const dbMod = await import('../../utils/db')
vi.spyOn(dbMod.db, 'insert').mockImplementation((() => {
  const chain = {
    values: (v: { key: string; value: string }) => {
      inserted.push(v)
      return {
        onConflictDoUpdate: ({ set }: { set: { value: string } }) => {
          updated.push({ key: v.key, value: set.value })
          return Promise.resolve([{ id: 'x' }])
        },
      }
    },
  }
  return chain as unknown as ReturnType<typeof dbMod.db.insert>
}) as typeof dbMod.db.insert)

class FakeKv implements EdgeKv {
  readonly store = new Map<string, { value: string; ttl: number }>()
  readonly deletes = new Array<string>()

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
    this.deletes.push(key)
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

import {
  getSchoolSettings,
  updateSchoolSettings,
  getPublicSchoolSettings,
} from '../school-settings'

describe('school settings service', () => {
  beforeEach(() => {
    storedRows = []
    inserted.length = 0
    updated.length = 0
  })

  it('returns defaults when no rows exist', async () => {
    storedRows = []
    const settings = await getSchoolSettings(eventWith(null))
    expect(settings.name).toBe('Victorious Children School')
    expect(settings.primaryColor).toBe('#1a237e')
    expect(settings.currency).toBe('NGN')
    expect(settings.academicYearStartMonth).toBe(9)
  })

  it('merges stored values into the typed object', async () => {
    storedRows = [
      { key: 'school.name', value: 'Renamed School' },
      { key: 'school.academic_year_start_month', value: '1' },
      { key: 'school.bank_name', value: 'GTBank' },
    ]
    const settings = await getSchoolSettings(eventWith(null))
    expect(settings.name).toBe('Renamed School')
    expect(settings.academicYearStartMonth).toBe(1)
    expect(settings.bankName).toBe('GTBank')
    // Unset keys fall back to defaults.
    expect(settings.motto).toBe('')
  })

  it('coerces an out-of-range month to null', async () => {
    storedRows = [
      { key: 'school.academic_year_start_month', value: '99' },
    ]
    const settings = await getSchoolSettings(eventWith(null))
    expect(settings.academicYearStartMonth).toBeNull()
  })

  it('upserts only the patched fields', async () => {
    storedRows = [{ key: 'school.name', value: 'Old' }]
    await updateSchoolSettings(eventWith(null), {
      bankName: 'First Bank',
      currency: 'USD',
    })
    const keys = inserted.map((r) => r.key)
    expect(keys).toContain('school.bank_name')
    expect(keys).toContain('school.currency')
    expect(keys).not.toContain('school.name')
    expect(updated.find((u) => u.key === 'school.bank_name')?.value).toBe('First Bank')
    expect(updated.find((u) => u.key === 'school.currency')?.value).toBe('USD')
  })

  it('stores an empty string for a cleared field', async () => {
    await updateSchoolSettings(eventWith(null), { motto: '' })
    const row = inserted.find((r) => r.key === 'school.motto')
    expect(row?.value).toBe('')
  })

  it('public subset excludes bank/finance/academic fields', async () => {
    storedRows = [
      { key: 'school.name', value: 'Public' },
      { key: 'school.bank_name', value: 'Secret' },
      { key: 'school.academic_year_start_month', value: '9' },
    ]
    const pub = await getPublicSchoolSettings(eventWith(null))
    expect(pub.name).toBe('Public')
    expect(pub).not.toHaveProperty('bankName')
    expect(pub).not.toHaveProperty('academicYearStartMonth')
  })
})

describe('school settings KV cache (Phase 12)', () => {
  beforeEach(() => {
    storedRows = []
    inserted.length = 0
    updated.length = 0
  })

  it('caches the merged settings after the first read', async () => {
    const kv = new FakeKv()
    storedRows = [{ key: 'school.name', value: 'Cached School' }]

    const first = await getSchoolSettings(eventWith(kv))
    expect(first.name).toBe('Cached School')
    // The cache entry was populated.
    expect(kv.store.has('cache:school:settings')).toBe(true)
    expect(kv.store.get('cache:school:settings')?.ttl).toBe(60)

    // Mutate the DB-side rows; a cached read must NOT observe the change.
    storedRows = [{ key: 'school.name', value: 'Stale School' }]
    const second = await getSchoolSettings(eventWith(kv))
    expect(second.name).toBe('Cached School')
  })

  it('falls through to D1 when the cache is empty', async () => {
    const kv = new FakeKv()
    storedRows = [{ key: 'school.name', value: 'From Db' }]
    const settings = await getSchoolSettings(eventWith(kv))
    expect(settings.name).toBe('From Db')
    expect(kv.store.has('cache:school:settings')).toBe(true)
  })

  it('bypasses the cache when no EDGE_KV binding is bound (Node dev)', async () => {
    storedRows = [{ key: 'school.name', value: 'No Cache' }]
    const first = await getSchoolSettings(eventWith(null))
    const second = await getSchoolSettings(eventWith(null))
    expect(first.name).toBe('No Cache')
    expect(second.name).toBe('No Cache')
  })

  it('invalidates the cache after an update so the next read is fresh', async () => {
    const kv = new FakeKv()
    storedRows = [{ key: 'school.name', value: 'Original' }]
    await getSchoolSettings(eventWith(kv))
    expect(kv.store.has('cache:school:settings')).toBe(true)

    // The DB mock's `.where` always returns storedRows; update the rows
    // to reflect the upsert so the next cache-miss read sees "Updated".
    storedRows = [{ key: 'school.name', value: 'Updated' }]
    await updateSchoolSettings(eventWith(kv), { name: 'Updated' })

    // Invalidation fired.
    expect(kv.deletes).toContain('cache:school:settings')
    expect(kv.store.has('cache:school:settings')).toBe(true) // repopulated by the trailing read

    // The fresh read returns the new value, not the original cached one.
    const settings = await getSchoolSettings(eventWith(kv))
    expect(settings.name).toBe('Updated')
  })

  it('public subset reads from the same cache entry as the full object', async () => {
    const kv = new FakeKv()
    storedRows = [
      { key: 'school.name', value: 'Cached Public' },
      { key: 'school.bank_name', value: 'Secret' },
    ]
    await getSchoolSettings(eventWith(kv))

    // Flip the DB rows; the cached full read must serve the public path.
    storedRows = [{ key: 'school.name', value: 'Stale' }]
    const pub = await getPublicSchoolSettings(eventWith(kv))
    expect(pub.name).toBe('Cached Public')
    expect(pub).not.toHaveProperty('bankName')
  })
})
