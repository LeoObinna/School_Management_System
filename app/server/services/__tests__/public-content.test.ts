/**
 * Phase 18B public content service tests.
 *
 * The DB layer is mocked with a chainable thenable: every drizzle builder
 * method returns the same object and awaiting it resolves the next entry
 * from a FIFO queue, in the exact order the service issues its queries.
 * This lets us assert the JS-side publication/audience double-gates, the
 * payload mapping (safe fields only) and the KV cache behavior without a
 * live D1 runtime.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { EdgeKv } from '../../utils/auth/edge-kv'

// FIFO queue of query results, one per awaited query the service issues.
let resultQueue: unknown[][] = []

vi.mock('../../utils/db', () => {
  const chainable = () => {
    const resolve = () => Promise.resolve(resultQueue.shift() ?? [])
    const chain: Record<string, unknown> = {}
    for (const method of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      chain[method] = () => chain
    }
    const promise = resolve()
    chain.then = promise.then.bind(promise)
    chain.catch = promise.catch.bind(promise)
    chain.finally = promise.finally.bind(promise)
    return chain
  }
  return {
    db: {
      select: vi.fn().mockImplementation(() => chainable()),
    },
  }
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

import {
  getPublicAcademics,
  getPublicAlbum,
  getPublicAlbums,
  getPublicEvents,
  getPublicImageForStream,
  getPublicNews,
  getPublicNewsItem,
  PUBLIC_IMAGE_BASE_URL,
} from '../public'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_C = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  resultQueue = []
})

describe('public news (Phase 18B)', () => {
  it('maps published, audience-all announcements and drops the rest', async () => {
    resultQueue = [
      [{ n: 3 }],
      [
        {
          id: UUID_A,
          title: 'Resumption',
          body: 'School resumes.',
          publishedAt: '2026-01-05T08:00:00.000Z',
          status: 'published',
          audience: 'all',
        },
        // Double-gate: rows the SQL filter should already have excluded
        // must still never reach the payload.
        {
          id: UUID_B,
          title: 'Draft',
          body: null,
          publishedAt: null,
          status: 'draft',
          audience: 'all',
        },
        {
          id: UUID_C,
          title: 'Staff only',
          body: null,
          publishedAt: '2026-01-06T08:00:00.000Z',
          status: 'published',
          audience: 'staff',
        },
      ],
    ]
    const list = await getPublicNews({ page: 1, perPage: 12 })
    expect(list.meta).toEqual({
      currentPage: 1,
      perPage: 12,
      total: 3,
      lastPage: 1,
    })
    expect(list.data).toEqual([
      {
        id: UUID_A,
        title: 'Resumption',
        body: 'School resumes.',
        publishedAt: '2026-01-05T08:00:00.000Z',
      },
    ])
  })

  it('returns one item only when published and audience-all', async () => {
    resultQueue = [
      [
        {
          id: UUID_A,
          title: 'Resumption',
          body: 'School resumes.',
          publishedAt: '2026-01-05T08:00:00.000Z',
          status: 'published',
          audience: 'all',
        },
      ],
    ]
    const item = await getPublicNewsItem(UUID_A)
    expect(item.title).toBe('Resumption')
    expect(item).not.toHaveProperty('status')
    expect(item).not.toHaveProperty('audience')
    expect(item).not.toHaveProperty('authorId')
  })

  it('404s drafts, targeted audiences and unknown ids identically', async () => {
    // Draft
    resultQueue = [
      [
        {
          id: UUID_A,
          title: 'Draft',
          body: null,
          publishedAt: null,
          status: 'draft',
          audience: 'all',
        },
      ],
    ]
    await expect(getPublicNewsItem(UUID_A)).rejects.toMatchObject({
      statusCode: 404,
    })

    // Targeted audience
    resultQueue = [
      [
        {
          id: UUID_B,
          title: 'Parents',
          body: null,
          publishedAt: '2026-01-05T08:00:00.000Z',
          status: 'published',
          audience: 'parents',
        },
      ],
    ]
    await expect(getPublicNewsItem(UUID_B)).rejects.toMatchObject({
      statusCode: 404,
    })

    // Unknown id
    resultQueue = [[]]
    await expect(getPublicNewsItem(UUID_C)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('public events (Phase 18B)', () => {
  it('maps published, audience-all events and drops the rest', async () => {
    resultQueue = [
      [{ n: 2 }],
      [
        {
          id: UUID_A,
          title: 'Open Day',
          description: 'Visit us.',
          startsAt: '2026-03-01T09:00:00.000Z',
          endsAt: null,
          location: 'School hall',
          status: 'published',
          audience: 'all',
        },
        {
          id: UUID_B,
          title: 'Staff briefing',
          description: null,
          startsAt: '2026-03-02T09:00:00.000Z',
          endsAt: null,
          location: null,
          status: 'published',
          audience: 'staff',
        },
      ],
    ]
    const list = await getPublicEvents({ when: 'upcoming', page: 1, perPage: 12 })
    expect(list.data).toEqual([
      {
        id: UUID_A,
        title: 'Open Day',
        description: 'Visit us.',
        startsAt: '2026-03-01T09:00:00.000Z',
        endsAt: null,
        location: 'School hall',
      },
    ])
  })
})

describe('public gallery (Phase 18B)', () => {
  const albumRow = {
    id: UUID_A,
    title: 'Sports Day',
    description: null,
    coverObjectKey: 'gallery/img-2.jpg',
    isPublished: true,
    eventTitle: 'Sports Day 2026',
    eventStatus: 'published',
    imageCount: 2,
  }

  it('lists published albums with cover URLs, never object keys', async () => {
    resultQueue = [
      [{ n: 2 }],
      [
        albumRow,
        { ...albumRow, id: UUID_B, title: 'Draft album', isPublished: false },
      ],
      [
        { albumId: UUID_A, id: UUID_C, objectKey: 'gallery/img-1.jpg' },
        { albumId: UUID_A, id: UUID_B, objectKey: 'gallery/img-2.jpg' },
      ],
    ]
    const list = await getPublicAlbums({ page: 1, perPage: 12 })
    expect(list.data).toHaveLength(1)
    const album = list.data[0]!
    expect(album.title).toBe('Sports Day')
    // coverObjectKey matches the second image → its public URL is the cover.
    expect(album.coverUrl).toBe(
      `${PUBLIC_IMAGE_BASE_URL}/${UUID_B}?variant=thumb`,
    )
    expect(album.eventTitle).toBe('Sports Day 2026')
    expect(album).not.toHaveProperty('coverObjectKey')
    expect(album).not.toHaveProperty('isPublished')
  })

  it('falls back to the first image when no cover is set, and hides draft event titles', async () => {
    resultQueue = [
      [{ n: 1 }],
      [
        {
          ...albumRow,
          coverObjectKey: null,
          eventTitle: 'Secret draft',
          eventStatus: 'draft',
        },
      ],
      [{ albumId: UUID_A, id: UUID_C, objectKey: 'gallery/img-1.jpg' }],
    ]
    const list = await getPublicAlbums({ page: 1, perPage: 12 })
    expect(list.data[0]!.coverUrl).toBe(
      `${PUBLIC_IMAGE_BASE_URL}/${UUID_C}?variant=thumb`,
    )
    expect(list.data[0]!.eventTitle).toBeNull()
  })

  it('album detail maps images to route URLs and 404s unpublished albums', async () => {
    resultQueue = [
      [{ ...albumRow, eventStatus: null, eventTitle: null }],
      [
        {
          id: UUID_C,
          albumId: UUID_A,
          objectKey: 'gallery/img-1.jpg',
          thumbObjectKey: 'gallery/img-1.thumb.jpg',
          fileName: 'img-1.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1000,
          caption: 'Finish line',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    ]
    const detail = await getPublicAlbum(UUID_A)
    expect(detail.imageCount).toBe(1)
    expect(detail.images).toEqual([
      {
        id: UUID_C,
        url: `${PUBLIC_IMAGE_BASE_URL}/${UUID_C}`,
        thumbUrl: `${PUBLIC_IMAGE_BASE_URL}/${UUID_C}?variant=thumb`,
        caption: 'Finish line',
        fileName: 'img-1.jpg',
      },
    ])

    resultQueue = [[{ ...albumRow, isPublished: false }]]
    await expect(getPublicAlbum(UUID_A)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('streams an image only when its album is published', async () => {
    resultQueue = [
      [
        {
          image: {
            id: UUID_C,
            albumId: UUID_A,
            objectKey: 'gallery/img-1.jpg',
            thumbObjectKey: null,
            fileName: 'img-1.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1000,
            caption: null,
            createdAt: '2026-02-01T00:00:00.000Z',
          },
          albumPublished: true,
        },
      ],
    ]
    const image = await getPublicImageForStream(UUID_C)
    expect(image.objectKey).toBe('gallery/img-1.jpg')

    // Unpublished album and unknown id are indistinguishable 404s.
    resultQueue = [[{ image: { id: UUID_C }, albumPublished: false }]]
    await expect(getPublicImageForStream(UUID_C)).rejects.toMatchObject({
      statusCode: 404,
    })
    resultQueue = [[]]
    await expect(getPublicImageForStream(UUID_B)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('public academics (Phase 18B)', () => {
  it('groups active classes by level with active subject names, KV-cached', async () => {
    const kv = new FakeKv()
    resultQueue = [
      // session
      [
        {
          id: UUID_A,
          name: '2025/2026',
          startDate: '2025-09-08',
          endDate: '2026-07-24',
        },
      ],
      // terms
      [
        { name: 'First Term', startDate: null, endDate: null, isCurrent: false },
        { name: 'Second Term', startDate: null, endDate: null, isCurrent: true },
      ],
      // classes (sequence order as returned by SQL)
      [
        { id: UUID_A, name: 'Nursery 1', level: 'Nursery', isActive: true },
        { id: UUID_B, name: 'Primary 1', level: 'Primary', isActive: true },
        { id: UUID_C, name: 'Retired class', level: 'Primary', isActive: false },
      ],
      // class-subject links
      [
        { classId: UUID_A, subjectName: 'Phonics', subjectActive: true },
        { classId: UUID_B, subjectName: 'Mathematics', subjectActive: true },
        { classId: UUID_B, subjectName: 'Retired subject', subjectActive: false },
      ],
    ]
    const payload = await getPublicAcademics(eventWith(kv))
    expect(payload.session?.name).toBe('2025/2026')
    expect(payload.terms.map((t) => t.name)).toEqual([
      'First Term',
      'Second Term',
    ])
    expect(payload.levels).toEqual([
      {
        name: 'Nursery',
        classes: [{ id: UUID_A, name: 'Nursery 1', subjects: ['Phonics'] }],
      },
      {
        name: 'Primary',
        classes: [{ id: UUID_B, name: 'Primary 1', subjects: ['Mathematics'] }],
      },
    ])

    const cached = kv.store.get('cache:public:academics')
    expect(cached).toBeDefined()
    expect(cached?.ttl).toBe(300)

    // Cached read issues no new queries.
    resultQueue = []
    const again = await getPublicAcademics(eventWith(kv))
    expect(again.levels).toHaveLength(2)
  })

  it('groups classes without a level under a null level name', async () => {
    resultQueue = [
      [], // no current session
      [
        { id: UUID_A, name: 'Creche', level: null, isActive: true },
        { id: UUID_B, name: 'Nursery 1', level: 'Nursery', isActive: true },
      ],
      [],
    ]
    const payload = await getPublicAcademics(eventWith(null))
    expect(payload.session).toBeNull()
    expect(payload.terms).toEqual([])
    expect(payload.levels.map((l) => l.name)).toEqual([null, 'Nursery'])
  })
})
