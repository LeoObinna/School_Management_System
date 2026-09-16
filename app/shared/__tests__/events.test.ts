import { describe, it, expect } from 'vitest'
import {
  eventCreateSchema,
  eventUpdateSchema,
  eventListQuerySchema,
  albumCreateSchema,
  albumUpdateSchema,
  albumListQuerySchema,
  galleryImageCaptionSchema,
  EVENT_STATUSES,
} from '../schemas/events'

describe('eventCreateSchema', () => {
  const valid = {
    title: 'Annual Sports Day',
    startsAt: '2026-10-15T09:00:00.000Z',
  }

  it('accepts a minimal event', () => {
    const result = eventCreateSchema.parse(valid)
    expect(result.title).toBe('Annual Sports Day')
  })

  it('accepts a full event', () => {
    const result = eventCreateSchema.parse({
      ...valid,
      description: 'Annual athletics competition',
      endsAt: '2026-10-15T16:00:00.000Z',
      location: 'School ground',
      audience: 'all',
      status: 'published',
    })
    expect(result.location).toBe('School ground')
    expect(result.status).toBe('published')
  })

  it('rejects an invalid datetime', () => {
    expect(() =>
      eventCreateSchema.parse({ ...valid, startsAt: 'not-a-date' }),
    ).toThrow()
  })

  it('rejects an invalid status', () => {
    expect(() =>
      eventCreateSchema.parse({ ...valid, status: 'pending' }),
    ).toThrow()
  })
})

describe('eventUpdateSchema', () => {
  it('accepts a partial update', () => {
    const result = eventUpdateSchema.parse({ title: 'Updated event' })
    expect(result.title).toBe('Updated event')
  })

  it('rejects an empty update', () => {
    expect(() => eventUpdateSchema.parse({})).toThrow(
      /At least one field/,
    )
  })
})

describe('eventListQuerySchema', () => {
  it('applies defaults', () => {
    const result = eventListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
  })

  it('accepts status and date range filters', () => {
    const result = eventListQuerySchema.parse({
      status: 'published',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.000Z',
    })
    expect(result.status).toBe('published')
    expect(result.from).toBe('2026-10-01T00:00:00.000Z')
  })
})

describe('albumCreateSchema', () => {
  it('accepts a minimal album', () => {
    const result = albumCreateSchema.parse({ title: 'Sports Day 2026' })
    expect(result.title).toBe('Sports Day 2026')
  })

  it('accepts a full album', () => {
    const result = albumCreateSchema.parse({
      title: 'Cultural Festival',
      description: 'Photos from the event',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      isPublished: false,
    })
    expect(result.eventId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.isPublished).toBe(false)
  })

  it('rejects an empty title', () => {
    expect(() => albumCreateSchema.parse({ title: '' })).toThrow()
  })
})

describe('albumUpdateSchema', () => {
  it('accepts a partial update', () => {
    const result = albumUpdateSchema.parse({ isPublished: true })
    expect(result.isPublished).toBe(true)
  })

  it('rejects an empty update', () => {
    expect(() => albumUpdateSchema.parse({})).toThrow(/At least one field/)
  })
})

describe('albumListQuerySchema', () => {
  it('accepts eventId and isPublished filters', () => {
    const result = albumListQuerySchema.parse({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      isPublished: 'true',
    })
    expect(result.eventId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.isPublished).toBe(true)
  })
})

describe('galleryImageCaptionSchema', () => {
  it('accepts a caption', () => {
    expect(galleryImageCaptionSchema.parse('A great moment')).toBe(
      'A great moment',
    )
  })

  it('accepts null and undefined', () => {
    expect(galleryImageCaptionSchema.parse(null)).toBeNull()
    expect(galleryImageCaptionSchema.parse(undefined)).toBeUndefined()
  })
})

describe('EVENT_STATUSES', () => {
  it('contains draft, published, cancelled', () => {
    expect(EVENT_STATUSES).toEqual(['draft', 'published', 'cancelled'])
  })
})
