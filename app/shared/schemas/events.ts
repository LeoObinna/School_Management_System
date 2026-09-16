/**
 * Events and gallery validation schemas (README §22, Phase 10).
 *
 * Events have a simple draft/published/cancelled lifecycle. Gallery
 * images are stored in R2 with metadata in PostgreSQL; thumbnails are
 * deferred to Phase 12.
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'
import { AUDIENCES } from './communication'

export const EVENT_STATUSES = ['draft', 'published', 'cancelled'] as const

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const eventCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(20000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  audience: z.enum(AUDIENCES).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
})

export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(255).nullable().optional(),
    audience: z.enum(AUDIENCES).optional(),
    status: z.enum(EVENT_STATUSES).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  })

export const eventListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(EVENT_STATUSES).optional(),
  audience: z.enum(AUDIENCES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

// ---------------------------------------------------------------------------
// Gallery albums
// ---------------------------------------------------------------------------
export const albumCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  eventId: uuidSchema.nullable().optional(),
  isPublished: z.boolean().optional(),
})

export const albumUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    eventId: uuidSchema.nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  })

export const albumListQuerySchema = paginationQuerySchema.extend({
  eventId: uuidSchema.optional(),
  isPublished: booleanParamSchema.optional(),
})

// Gallery image caption (used in the upload form data).
export const galleryImageCaptionSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EventCreate = z.infer<typeof eventCreateSchema>
export type EventUpdate = z.infer<typeof eventUpdateSchema>
export type EventListQuery = z.infer<typeof eventListQuerySchema>
export type AlbumCreate = z.infer<typeof albumCreateSchema>
export type AlbumUpdate = z.infer<typeof albumUpdateSchema>
export type AlbumListQuery = z.infer<typeof albumListQuerySchema>
