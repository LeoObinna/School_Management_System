/**
 * Assignments, submissions and learning-resource validation schemas
 * (README §17, Phase 6). File bytes live in R2; multipart routes handle
 * uploads while these schemas cover JSON metadata and grading.
 */
import { z } from 'zod'
import {
  paginationQuerySchema,
  uuidSchema,
} from './common'

export const PUBLICATION_STATUSES = [
  'draft',
  'scheduled',
  'published',
  'archived',
] as const

export const SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'late',
  'graded',
  'returned',
] as const

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
const assignmentBaseSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
  subjectId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(255),
  instructions: z.string().trim().max(20000).nullable().optional(),
  maxScore: z.coerce.number().int().min(1).max(100000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
})

const sectionRule = {
  message: 'classId is required when sectionId is provided.',
  path: ['classId'],
}

export const assignmentCreateSchema = assignmentBaseSchema.refine(
  (d) => d.sectionId === undefined || d.sectionId === null || !!d.classId,
  sectionRule,
)
export type AssignmentCreate = z.infer<typeof assignmentCreateSchema>

export const assignmentUpdateSchema = assignmentBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
  .refine(
    (d) =>
      d.sectionId === undefined ||
      d.sectionId === null ||
      d.classId !== undefined,
    sectionRule,
  )
export type AssignmentUpdate = z.infer<typeof assignmentUpdateSchema>

export const assignmentListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  teacherId: uuidSchema.optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  mine: z.enum(['true', 'false']).optional(),
})
export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

// Student saves work. A submission carries text, a file, or both.
export const submissionUpsertSchema = z
  .object({
    textContent: z.string().trim().max(20000).nullable().optional(),
    // Set when a previously uploaded R2 object should be detached.
    removeFile: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Provide text content or upload a file.',
  })
export type SubmissionUpsert = z.infer<typeof submissionUpsertSchema>

// File metadata handed to the service by the multipart submission route
// after the bytes are safely in R2.
export interface SubmissionFileMeta {
  objectKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export const submissionGradeSchema = z.object({
  score: z.coerce.number().int().min(0),
  feedback: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(['graded', 'returned']).optional(),
})
export type SubmissionGrade = z.infer<typeof submissionGradeSchema>

export const submissionListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(SUBMISSION_STATUSES).optional(),
})
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>

export const myAssignmentListQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
})
export type MyAssignmentListQuery = z.infer<
  typeof myAssignmentListQuerySchema
>

// ---------------------------------------------------------------------------
// Learning resources
// ---------------------------------------------------------------------------
const resourceBaseSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  classId: uuidSchema.nullable().optional(),
  subjectId: uuidSchema.nullable().optional(),
  isPublished: z.boolean().optional(),
  // File metadata is supplied by the multipart route after the R2 put.
  objectKey: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
})

export const resourceCreateSchema = resourceBaseSchema
export type ResourceCreate = z.infer<typeof resourceCreateSchema>

export const resourceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).nullable(),
    classId: uuidSchema.nullable(),
    subjectId: uuidSchema.nullable(),
    isPublished: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type ResourceUpdate = z.infer<typeof resourceUpdateSchema>

export const resourceListQuerySchema = paginationQuerySchema.extend({
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
})
export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>
