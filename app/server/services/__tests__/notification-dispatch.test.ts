import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import {
  AUDIENCE_ROLES,
  audienceSqlFragment,
  countAnnouncementRecipients,
  dispatchAnnouncement,
  dispatchMessage,
  parseQueueMessage,
} from '../notification-dispatch'
import type { SmsDb } from '../../utils/pagination'

// Minimal chainable Drizzle-like client: select(...).from().where().limit()
// resolves to a configurable row set; execute() resolves to a raw result.
function makeClient(options: {
  announcement?: Record<string, unknown> | null
  executeResult?: unknown
}) {
  const execute = vi.fn(async () => options.executeResult ?? { count: '3' })
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      options.announcement === null
        ? []
        : [options.announcement ?? defaultAnnouncement()],
    ),
  }
  const select = vi.fn(() => selectChain)
  const client = { select, execute } as unknown as SmsDb
  return { client, select, execute }
}

function defaultAnnouncement() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'School reopens',
    body: 'Monday',
    audience: 'all',
    status: 'published',
  }
}

const validMessage = {
  kind: 'announcement.published' as const,
  announcementId: '11111111-1111-4111-8111-111111111111',
}

// drizzle sql`...` values only expose `queryChunks` (nested arrays for
// raw SQL text, primitives for bound parameters). Renders them to
// { text, params } for assertions without a live database.
function renderSql(sqlObj: {
  queryChunks: unknown[]
}): { text: string; params: unknown[] } {
  const params: unknown[] = []
  const walk = (chunks: unknown[]): string =>
    chunks
      .map((chunk) => {
        // StringChunk: an array-like wrapper whose string elements are
        // raw SQL TEXT (never bind parameters).
        if (Array.isArray(chunk)) {
          return (chunk as unknown[]).map((c) => String(c)).join('')
        }
        if (chunk && typeof chunk === 'object') {
          const c = chunk as Record<string, unknown>
          if (Array.isArray(c.value)) {
            return (c.value as unknown[]).map((v) => String(v)).join('')
          }
          // Nested sql`...` fragment.
          if ('queryChunks' in c) {
            return walk(c.queryChunks as unknown[])
          }
        }
        // A bare primitive in a queryChunks slot is a bind parameter.
        params.push(chunk)
        return '?'
      })
      .join('')
  return { text: walk(sqlObj.queryChunks), params }
}

// Pulls the first argument of the first client.execute() mock call and
// renders it as { text, params }.
function renderedExecute(execute: ReturnType<typeof vi.fn>) {
  const arg = (execute.mock.calls[0] as unknown[])[0] as {
    queryChunks: unknown[]
  }
  return renderSql(arg)
}

describe('parseQueueMessage', () => {
  it('accepts a valid announcement.published object', () => {
    expect(parseQueueMessage(validMessage)).toEqual(validMessage)
  })

  it('accepts a JSON-serialised envelope', () => {
    expect(parseQueueMessage(JSON.stringify(validMessage))).toEqual(
      validMessage,
    )
  })

  it('rejects an unknown message kind', () => {
    expect(() =>
      parseQueueMessage({ kind: 'email.send', id: 'x' }),
    ).toThrow(z.ZodError)
  })

  it('rejects a malformed announcementId', () => {
    expect(() =>
      parseQueueMessage({ kind: 'announcement.published', announcementId: 7 }),
    ).toThrow(z.ZodError)
  })

  it('rejects a non-uuid announcementId', () => {
    expect(() =>
      parseQueueMessage({ kind: 'announcement.published', announcementId: 'nope' }),
    ).toThrow(z.ZodError)
  })

  it('rejects garbage that is not even JSON', () => {
    expect(() => parseQueueMessage('not-json')).toThrow(z.ZodError)
  })
})

describe('AUDIENCE_ROLES / audienceSqlFragment', () => {
  it('maps all six audiences', () => {
    expect(Object.keys(AUDIENCE_ROLES).sort()).toEqual(
      ['admins', 'all', 'parents', 'staff', 'students', 'teachers'].sort(),
    )
  })

  it('builds an active-user-only fragment for audience "all"', () => {
    const { text, params } = renderSql(
      audienceSqlFragment('all') as unknown as { queryChunks: unknown[] },
    )
    expect(text).toContain('is_active = true')
    expect(params).toEqual([])
  })

  it('binds role slugs as parameters for a scoped audience', () => {
    const { text, params } = renderSql(
      audienceSqlFragment('teachers') as unknown as {
        queryChunks: unknown[]
      },
    )
    expect(text).toContain('r.slug IN')
    expect(params).toEqual(['teacher'])
  })

  it('maps admins and staff to the admin role slugs', () => {
    const admins = renderSql(
      audienceSqlFragment('admins') as unknown as { queryChunks: unknown[] },
    )
    const staff = renderSql(
      audienceSqlFragment('staff') as unknown as { queryChunks: unknown[] },
    )
    expect(admins.params).toEqual(['super_admin', 'admin'])
    expect(staff.params).toEqual(['super_admin', 'admin'])
  })
})

describe('countAnnouncementRecipients', () => {
  it('returns the counted recipients as a number', async () => {
    const { client, execute } = makeClient({ executeResult: [{ n: '42' }] })
    await expect(countAnnouncementRecipients(client, 'parents')).resolves.toBe(
      42,
    )
    expect(renderedExecute(execute).text).toContain('count(*)')
  })

  it('coerces missing rows to zero', async () => {
    const { client } = makeClient({ executeResult: [] })
    await expect(countAnnouncementRecipients(client, 'all')).resolves.toBe(0)
  })
})

describe('dispatchAnnouncement', () => {
  it('inserts idempotent announcement notifications and returns the count', async () => {
    const { client, execute } = makeClient({})
    const count = await dispatchAnnouncement(client, validMessage.announcementId)
    expect(count).toBe(3)
    const sqlText = renderedExecute(execute).text
    expect(sqlText).toContain('INSERT INTO notifications')
    expect(sqlText).toContain('announcement_id')
    expect(sqlText).toContain('ON CONFLICT')
    expect(sqlText).toContain('DO NOTHING')
  })

  it('is a no-op (0 rows) when the announcement is no longer published', async () => {
    const { client, execute } = makeClient({
      announcement: { ...defaultAnnouncement(), status: 'archived' },
    })
    await expect(
      dispatchAnnouncement(client, validMessage.announcementId),
    ).resolves.toBe(0)
    expect(execute).not.toHaveBeenCalled()
  })

  it('throws 404 when the announcement does not exist', async () => {
    const { client } = makeClient({ announcement: null })
    await expect(
      dispatchAnnouncement(client, validMessage.announcementId),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('dispatchMessage', () => {
  it('routes announcement.published to the announcement dispatcher', async () => {
    const { client, execute } = makeClient({ executeResult: { count: '7' } })
    await expect(dispatchMessage(client, validMessage)).resolves.toBe(7)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('rejects a malformed body before touching the database', async () => {
    const { client, execute } = makeClient({})
    await expect(dispatchMessage(client, { kind: 'bogus' })).rejects.toThrow(
      z.ZodError,
    )
    expect(execute).not.toHaveBeenCalled()
  })
})
