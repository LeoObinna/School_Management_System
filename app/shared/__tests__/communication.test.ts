import { describe, it, expect } from 'vitest'
import {
  announcementCreateSchema,
  announcementUpdateSchema,
  announcementListQuerySchema,
  notificationListQuerySchema,
  messageCreateSchema,
  messageListQuerySchema,
  AUDIENCES,
  NOTIFICATION_STATUSES,
} from '../schemas/communication'

describe('announcementCreateSchema', () => {
  it('accepts a minimal announcement', () => {
    const result = announcementCreateSchema.parse({
      title: 'Term 3 exams schedule',
    })
    expect(result.title).toBe('Term 3 exams schedule')
    expect(result.body).toBeUndefined()
  })

  it('accepts a full announcement', () => {
    const result = announcementCreateSchema.parse({
      title: 'Parent-teacher meeting',
      body: 'Scheduled for next Friday.',
      audience: 'parents',
      status: 'draft',
    })
    expect(result.audience).toBe('parents')
    expect(result.status).toBe('draft')
  })

  it('rejects an empty title', () => {
    expect(() => announcementCreateSchema.parse({ title: '' })).toThrow()
  })

  it('rejects an invalid audience', () => {
    expect(() =>
      announcementCreateSchema.parse({ title: 'Test', audience: 'visitors' }),
    ).toThrow()
  })

  it('accepts a scheduled announcement with a future timestamp', () => {
    const result = announcementCreateSchema.parse({
      title: 'Holiday closure',
      status: 'scheduled',
      scheduledFor: '2099-12-20T08:00:00.000Z',
    })
    expect(result.status).toBe('scheduled')
    expect(result.scheduledFor).toBe('2099-12-20T08:00:00.000Z')
  })

  it('rejects a scheduled announcement without scheduledFor', () => {
    expect(() =>
      announcementCreateSchema.parse({ title: 'Later', status: 'scheduled' }),
    ).toThrow(/scheduledFor is required/)
  })

  it('rejects scheduledFor on a non-scheduled announcement', () => {
    expect(() =>
      announcementCreateSchema.parse({
        title: 'Now',
        status: 'draft',
        scheduledFor: '2099-12-20T08:00:00.000Z',
      }),
    ).toThrow(/can only be set when status/)
  })

  it('rejects a non-ISO scheduledFor value', () => {
    expect(() =>
      announcementCreateSchema.parse({
        title: 'Later',
        status: 'scheduled',
        scheduledFor: 'next monday',
      }),
    ).toThrow()
  })
})

describe('announcementUpdateSchema', () => {
  it('accepts a partial update', () => {
    const result = announcementUpdateSchema.parse({ title: 'Updated title' })
    expect(result.title).toBe('Updated title')
  })

  it('requires scheduledFor when switching to scheduled status', () => {
    expect(() =>
      announcementUpdateSchema.parse({ status: 'scheduled' }),
    ).toThrow(/scheduledFor is required/)
  })

  it('accepts switching to scheduled with a timestamp', () => {
    const result = announcementUpdateSchema.parse({
      status: 'scheduled',
      scheduledFor: '2099-12-20T08:00:00.000Z',
    })
    expect(result.status).toBe('scheduled')
  })

  it('rejects an empty update', () => {
    expect(() => announcementUpdateSchema.parse({})).toThrow(
      /At least one field/,
    )
  })
})

describe('announcementListQuerySchema', () => {
  it('applies pagination defaults', () => {
    const result = announcementListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
    expect(result.order).toBe('asc')
  })

  it('accepts status and audience filters', () => {
    const result = announcementListQuerySchema.parse({
      status: 'published',
      audience: 'staff',
    })
    expect(result.status).toBe('published')
    expect(result.audience).toBe('staff')
  })
})

describe('notificationListQuerySchema', () => {
  it('applies defaults', () => {
    const result = notificationListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
  })

  it('accepts status filter', () => {
    const result = notificationListQuerySchema.parse({ status: 'unread' })
    expect(result.status).toBe('unread')
  })
})

describe('messageCreateSchema', () => {
  it('accepts recipientId', () => {
    const result = messageCreateSchema.parse({
      recipientId: '550e8400-e29b-41d4-a716-446655440000',
      body: 'Hello there',
    })
    expect(result.recipientId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.body).toBe('Hello there')
  })

  it('accepts recipientEmail instead of recipientId', () => {
    const result = messageCreateSchema.parse({
      recipientEmail: 'teacher@example.test',
      body: 'Test message',
    })
    expect(result.recipientEmail).toBe('teacher@example.test')
  })

  it('rejects when neither recipientId nor recipientEmail is given', () => {
    expect(() => messageCreateSchema.parse({ body: 'No recipient' })).toThrow(
      /Either recipientId or recipientEmail/,
    )
  })

  it('rejects an empty body', () => {
    expect(() =>
      messageCreateSchema.parse({
        recipientId: '550e8400-e29b-41d4-a716-446655440000',
        body: '',
      }),
    ).toThrow()
  })

  it('lowercases the email', () => {
    const result = messageCreateSchema.parse({
      recipientEmail: 'Teacher@Example.TEST',
      body: 'Hi',
    })
    expect(result.recipientEmail).toBe('teacher@example.test')
  })
})

describe('messageListQuerySchema', () => {
  it('applies defaults', () => {
    const result = messageListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
  })

  it('accepts isRead and direction filters', () => {
    const result = messageListQuerySchema.parse({
      isRead: 'false',
      direction: 'inbound',
    })
    expect(result.isRead).toBe(false)
    expect(result.direction).toBe('inbound')
  })
})

describe('enum exports', () => {
  it('AUDIENCES contains all six audiences', () => {
    expect(AUDIENCES).toEqual([
      'all',
      'staff',
      'teachers',
      'students',
      'parents',
      'admins',
    ])
  })

  it('NOTIFICATION_STATUSES contains unread and read', () => {
    expect(NOTIFICATION_STATUSES).toEqual(['unread', 'read'])
  })
})
