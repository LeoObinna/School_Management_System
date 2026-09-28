/**
 * Phase 17B: notification preferences + newsletter subscription service tests.
 *
 * The DB layer is mocked (same pattern as school-settings.test.ts): each
 * select() call pops the next queued result set, inserts/updates capture
 * their values for assertion. No live D1 runtime required.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let selectResults: unknown[][] = []
let selectIdx = 0
const insertedRows: Record<string, unknown>[] = []
const upsertSets: Record<string, unknown>[] = []
const updateSets: Record<string, unknown>[] = []

interface Chain extends Record<string, unknown> {
  then: (onFulfilled: (v: unknown) => unknown) => Promise<unknown>
}

function makeSelectChain(rows: unknown[]): Chain {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.orderBy = vi.fn(() => chain)
  // limit() returns the thenable chain so both `.limit(1)` (awaited) and
  // `.limit(n).offset(m)` (paginated) call shapes work.
  chain.limit = vi.fn(() => chain)
  chain.offset = vi.fn(() => Promise.resolve(rows))
  // Awaiting the chain directly (count query) resolves to the same rows.
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled)
  return chain as Chain
}

vi.mock('../../utils/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain(selectResults[selectIdx++] ?? [])),
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => {
        insertedRows.push(v)
        return {
          onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
            upsertSets.push(set)
            return Promise.resolve()
          },
          then: (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(undefined).then(onFulfilled),
        }
      },
    })),
    update: vi.fn(() => ({
      set: (s: Record<string, unknown>) => {
        updateSets.push(s)
        return { where: vi.fn(() => Promise.resolve()) }
      },
    })),
  },
}))

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeNewsletter,
  unsubscribeNewsletter,
  listNewsletterSubscriptions,
} from '../notifications'

beforeEach(() => {
  selectResults = []
  selectIdx = 0
  insertedRows.length = 0
  upsertSets.length = 0
  updateSets.length = 0
})

describe('getNotificationPreferences', () => {
  it('returns all-true defaults when no preferences row exists', async () => {
    selectResults.push([])
    const prefs = await getNotificationPreferences('user-1')
    expect(prefs).toEqual({
      announcementEmail: true,
      feeReminderEmail: true,
      resultPublishedEmail: true,
      paymentReceiptEmail: true,
      urgentSms: true,
      updatedAt: null,
    })
  })

  it('returns the stored row when one exists', async () => {
    selectResults.push([
      {
        userId: 'user-1',
        announcementEmail: false,
        feeReminderEmail: true,
        resultPublishedEmail: false,
        paymentReceiptEmail: true,
        urgentSms: false,
        updatedAt: '2026-09-28T00:00:00.000Z',
      },
    ])
    const prefs = await getNotificationPreferences('user-1')
    expect(prefs.announcementEmail).toBe(false)
    expect(prefs.resultPublishedEmail).toBe(false)
    expect(prefs.urgentSms).toBe(false)
    expect(prefs.feeReminderEmail).toBe(true)
    expect(prefs.updatedAt).toBe('2026-09-28T00:00:00.000Z')
  })
})

describe('updateNotificationPreferences', () => {
  it('upserts only the provided fields and returns the fresh row', async () => {
    // Final read-back performed by getNotificationPreferences.
    selectResults.push([
      {
        userId: 'user-1',
        announcementEmail: false,
        feeReminderEmail: true,
        resultPublishedEmail: true,
        paymentReceiptEmail: true,
        urgentSms: true,
        updatedAt: '2026-09-28T01:00:00.000Z',
      },
    ])

    const prefs = await updateNotificationPreferences('user-1', {
      announcementEmail: false,
    })

    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]!.userId).toBe('user-1')
    expect(insertedRows[0]!.announcementEmail).toBe(false)
    // Untouched fields must not appear in the upsert payload.
    expect(insertedRows[0]).not.toHaveProperty('feeReminderEmail')
    expect(insertedRows[0]).not.toHaveProperty('urgentSms')
    expect(upsertSets).toHaveLength(1)
    expect(upsertSets[0]!.announcementEmail).toBe(false)
    expect(upsertSets[0]).not.toHaveProperty('urgentSms')
    expect(prefs.announcementEmail).toBe(false)
  })
})

describe('subscribeNewsletter', () => {
  it('inserts a new subscription with a normalised email', async () => {
    selectResults.push([]) // no existing row
    const result = await subscribeNewsletter({
      email: '  Parent@Example.COM ',
      name: 'Ada',
    })
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]!.email).toBe('parent@example.com')
    expect(insertedRows[0]!.name).toBe('Ada')
    expect(insertedRows[0]!.status).toBe('subscribed')
    expect(result.status).toBe('subscribed')
    expect(result.email).toBe('parent@example.com')
  })

  it('is a no-op when the email is already subscribed', async () => {
    selectResults.push([
      {
        id: 'sub-1',
        email: 'parent@example.com',
        name: 'Ada',
        status: 'subscribed',
        subscribedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const result = await subscribeNewsletter({ email: 'parent@example.com' })
    expect(result.status).toBe('subscribed')
    expect(result.subscribedAt).toBe('2026-09-01T00:00:00.000Z')
    expect(insertedRows).toHaveLength(0)
    expect(updateSets).toHaveLength(0)
  })

  it('re-subscribes a previously unsubscribed email', async () => {
    selectResults.push([
      {
        id: 'sub-1',
        email: 'parent@example.com',
        name: 'Ada',
        status: 'unsubscribed',
        subscribedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const result = await subscribeNewsletter({ email: 'parent@example.com' })
    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]!.status).toBe('subscribed')
    expect(updateSets[0]!.unsubscribedAt).toBeNull()
    expect(insertedRows).toHaveLength(0)
    expect(result.status).toBe('subscribed')
  })
})

describe('unsubscribeNewsletter', () => {
  it('throws 404 when the email was never subscribed', async () => {
    selectResults.push([])
    await expect(
      unsubscribeNewsletter('ghost@example.com'),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('is a no-op when already unsubscribed', async () => {
    selectResults.push([
      {
        id: 'sub-1',
        email: 'parent@example.com',
        status: 'unsubscribed',
        subscribedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const result = await unsubscribeNewsletter('parent@example.com')
    expect(result.status).toBe('unsubscribed')
    expect(updateSets).toHaveLength(0)
  })

  it('marks a subscribed email as unsubscribed', async () => {
    selectResults.push([
      {
        id: 'sub-1',
        email: 'parent@example.com',
        status: 'subscribed',
        subscribedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const result = await unsubscribeNewsletter('PARENT@example.com')
    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]!.status).toBe('unsubscribed')
    expect(typeof updateSets[0]!.unsubscribedAt).toBe('string')
    expect(result.status).toBe('unsubscribed')
  })
})

describe('listNewsletterSubscriptions', () => {
  it('returns mapped rows with the total count', async () => {
    selectResults.push([{ count: 2 }]) // count query
    selectResults.push([
      {
        id: 'sub-2',
        email: 'b@example.com',
        name: null,
        status: 'subscribed',
        subscribedAt: '2026-09-02T00:00:00.000Z',
        unsubscribedAt: null,
        createdAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'sub-1',
        email: 'a@example.com',
        name: 'Ada',
        status: 'unsubscribed',
        subscribedAt: '2026-09-01T00:00:00.000Z',
        unsubscribedAt: '2026-09-10T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])

    const { data, total } = await listNewsletterSubscriptions({
      page: 1,
      perPage: 20,
    })
    expect(total).toBe(2)
    expect(data).toHaveLength(2)
    expect(data[0]).toEqual({
      id: 'sub-2',
      email: 'b@example.com',
      name: null,
      status: 'subscribed',
      subscribedAt: '2026-09-02T00:00:00.000Z',
      unsubscribedAt: null,
      createdAt: '2026-09-02T00:00:00.000Z',
    })
    expect(data[1]!.status).toBe('unsubscribed')
  })

  it('returns zero total when no rows match the filter', async () => {
    selectResults.push([{ count: 0 }])
    selectResults.push([])
    const { data, total } = await listNewsletterSubscriptions({
      status: 'unsubscribed',
      page: 1,
      perPage: 20,
    })
    expect(total).toBe(0)
    expect(data).toEqual([])
  })
})
