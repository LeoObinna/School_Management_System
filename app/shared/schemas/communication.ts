/**
 * Communication validation schemas (README §21, Phase 10).
 *
 * Announcements support draft/scheduled/published/archived and audience
 * targeting. When an announcement is published, notification rows are
 * created synchronously for every matching user (Queue-based async
 * email is deferred to Phase 12).
 *
 * Messages are internal user-to-user (senderId, recipientId).
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  emailSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'
import { PUBLICATION_STATUSES } from './assignments'

export const AUDIENCES = [
  'all',
  'staff',
  'teachers',
  'students',
  'parents',
  'admins',
] as const

export const NOTIFICATION_STATUSES = ['unread', 'read'] as const

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const announcementCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().max(20000).nullable().optional(),
    audience: z.enum(AUDIENCES).optional(),
    classId: uuidSchema.nullable().optional(),
    status: z.enum(PUBLICATION_STATUSES).optional(),
    // Required when status='scheduled'; ignored (stored as null) for
    // other statuses. Future-instant check lives in the service.
    scheduledFor: z.string().datetime().nullable().optional(),
  })
  .refine((obj) => obj.status !== 'scheduled' || Boolean(obj.scheduledFor), {
    message: 'scheduledFor is required when status is "scheduled".',
    path: ['scheduledFor'],
  })
  .refine(
    (obj) => obj.scheduledFor === undefined || obj.status === 'scheduled',
    {
      message: 'scheduledFor can only be set when status is "scheduled".',
      path: ['scheduledFor'],
    },
  )

export const announcementUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    body: z.string().trim().max(20000).nullable().optional(),
    audience: z.enum(AUDIENCES).optional(),
    classId: uuidSchema.nullable().optional(),
    status: z.enum(PUBLICATION_STATUSES).optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  })
  .refine((obj) => obj.status !== 'scheduled' || obj.scheduledFor !== undefined, {
    // Switching to 'scheduled' must carry a timestamp in the same
    // request; the service also accepts a timestamp already stored.
    message: 'scheduledFor is required when status is "scheduled".',
    path: ['scheduledFor'],
  })

export const announcementListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PUBLICATION_STATUSES).optional(),
  audience: z.enum(AUDIENCES).optional(),
})

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
})

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export const messageCreateSchema = z.object({
  recipientId: uuidSchema.optional(),
  recipientEmail: emailSchema.optional(),
  subject: z.string().trim().max(255).optional(),
  body: z.string().trim().min(1).max(20000),
}).refine(
  (obj) => obj.recipientId || obj.recipientEmail,
  { message: 'Either recipientId or recipientEmail is required' },
)

export const messageListQuerySchema = paginationQuerySchema.extend({
  isRead: booleanParamSchema.optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
})

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type AnnouncementCreate = z.infer<typeof announcementCreateSchema>
export type AnnouncementUpdate = z.infer<typeof announcementUpdateSchema>
export type AnnouncementListQuery = z.infer<
  typeof announcementListQuerySchema
>
export type NotificationListQuery = z.infer<
  typeof notificationListQuerySchema
>
export type MessageCreate = z.infer<typeof messageCreateSchema>
export type MessageListQuery = z.infer<typeof messageListQuerySchema>
