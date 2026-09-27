/**
 * Lesson note validation schemas (Phase 16D).
 *
 * Notes are authored by the calling teacher (resolved server-side);
 * the schemas never accept a teacherId. `week` is an optional integer
 * label for the teaching week within the term.
 */
import { z } from 'zod'
import { uuidSchema } from './common'

export const lessonNoteCreateSchema = z.object({
  classId: uuidSchema,
  subjectId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  week: z.number().int().min(1).max(52).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
})
export type LessonNoteCreate = z.infer<typeof lessonNoteCreateSchema>

export const lessonNoteUpdateSchema = lessonNoteCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  })
export type LessonNoteUpdate = z.infer<typeof lessonNoteUpdateSchema>

export const lessonNoteListQuerySchema = z.object({
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
})
export type LessonNoteListQuery = z.infer<typeof lessonNoteListQuerySchema>
