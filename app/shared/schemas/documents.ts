/**
 * Documents module schemas (Phase 14B).
 *
 * The file bytes are not part of these schemas — the multipart route
 * reads and validates them through `readUpload(event, 'school_document')`
 * and passes objectKey/fileName/mimeType into the create payload.
 */
import { z } from 'zod'
import { paginationQuerySchema, uuidSchema } from './common'

export const documentVisibilitySchema = z.enum(['staff', 'admin'])
export type DocumentVisibility = z.infer<typeof documentVisibilitySchema>

export const documentOwnerTypeSchema = z.enum(['school', 'staff'])
export type DocumentOwnerType = z.infer<typeof documentOwnerTypeSchema>

// Create payload (metadata only; bytes handled by the route).
export const documentCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  visibility: documentVisibilitySchema.default('staff'),
  ownerType: documentOwnerTypeSchema.default('school'),
  ownerId: uuidSchema.nullable().optional(),
  objectKey: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255),
  sizeBytes: z.number().int().min(0),
})
export type DocumentCreate = z.infer<typeof documentCreateSchema>

// Partial update of editable metadata (object bytes never change via PUT;
// replace a file by deleting and re-uploading).
export const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).nullable(),
    category: z.string().trim().max(100).nullable(),
    visibility: documentVisibilitySchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>

export const documentListQuerySchema = paginationQuerySchema.extend({
  ownerType: documentOwnerTypeSchema.optional(),
  ownerId: uuidSchema.optional(),
  category: z.string().trim().max(100).optional(),
  visibility: documentVisibilitySchema.optional(),
})
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>
