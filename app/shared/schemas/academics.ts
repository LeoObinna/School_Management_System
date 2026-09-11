/**
 * Academic structure validation schemas (README §13).
 *
 * Backs the admin CRUD for sessions, terms, classes, sections, subjects,
 * class subjects and teacher assignments. These schemas mirror the
 * Drizzle columns in `database/schema/academics.ts` + `enrollment.ts`:
 * slugs are derived server-side (never accepted from clients), levels,
 * section names and term names stay configurable data, and date
 * ordering rules are enforced without hard-coding school policy.
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  dateStringSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

// ---------------------------------------------------------------------------
// Academic sessions
// ---------------------------------------------------------------------------
const academicSessionBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const sessionDateOrderRule = {
  test: (d: { startDate?: string; endDate?: string }) =>
    d.startDate === undefined ||
    d.endDate === undefined ||
    d.endDate >= d.startDate,
  params: {
    message: 'End date must be on or after start date',
    path: ['endDate'] as [string, ...string[]],
  },
}

export const academicSessionCreateSchema = academicSessionBaseSchema.refine(
  sessionDateOrderRule.test,
  sessionDateOrderRule.params,
)
export type AcademicSessionCreate = z.infer<
  typeof academicSessionCreateSchema
>

export const academicSessionUpdateSchema = academicSessionBaseSchema
  .partial()
  .refine(sessionDateOrderRule.test, sessionDateOrderRule.params)
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type AcademicSessionUpdate = z.infer<
  typeof academicSessionUpdateSchema
>

export const academicSessionListQuerySchema = paginationQuerySchema.extend({
  isCurrent: booleanParamSchema,
  isActive: booleanParamSchema,
})
export type AcademicSessionListQuery = z.infer<
  typeof academicSessionListQuerySchema
>

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------
const termBaseSchema = z.object({
  sessionId: uuidSchema,
  name: z.string().trim().min(1).max(100),
  sequence: z.coerce.number().int().min(1),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const termCreateSchema = termBaseSchema.refine(
  sessionDateOrderRule.test,
  sessionDateOrderRule.params,
)
export type TermCreate = z.infer<typeof termCreateSchema>

export const termUpdateSchema = termBaseSchema
  .partial()
  .refine(sessionDateOrderRule.test, sessionDateOrderRule.params)
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type TermUpdate = z.infer<typeof termUpdateSchema>

export const termListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  isCurrent: booleanParamSchema,
  isActive: booleanParamSchema,
})
export type TermListQuery = z.infer<typeof termListQuerySchema>

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export const classCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Free-text level category (creche/nursery/primary/jss/ss) — data,
  // never a hard-coded enum.
  level: z.string().trim().max(100).optional(),
  sequence: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})
export type ClassCreate = z.infer<typeof classCreateSchema>

export const classUpdateSchema = classCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type ClassUpdate = z.infer<typeof classUpdateSchema>

export const classListQuerySchema = paginationQuerySchema.extend({
  level: z.string().trim().max(100).optional(),
  isActive: booleanParamSchema,
})
export type ClassListQuery = z.infer<typeof classListQuerySchema>

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export const sectionCreateSchema = z.object({
  classId: uuidSchema,
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(0).max(10000).optional(),
  room: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
})
export type SectionCreate = z.infer<typeof sectionCreateSchema>

export const sectionUpdateSchema = sectionCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type SectionUpdate = z.infer<typeof sectionUpdateSchema>

export const sectionListQuerySchema = paginationQuerySchema.extend({
  classId: uuidSchema.optional(),
  isActive: booleanParamSchema,
})
export type SectionListQuery = z.infer<typeof sectionListQuerySchema>

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
})
export type SubjectCreate = z.infer<typeof subjectCreateSchema>

export const subjectUpdateSchema = subjectCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type SubjectUpdate = z.infer<typeof subjectUpdateSchema>

export const subjectListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanParamSchema,
})
export type SubjectListQuery = z.infer<typeof subjectListQuerySchema>

// ---------------------------------------------------------------------------
// Class <-> Subject (a subject offered by a class)
// ---------------------------------------------------------------------------
export const classSubjectBodySchema = z.object({
  subjectId: uuidSchema,
  isCompulsory: z.boolean().default(true),
  maxScore: z.coerce.number().int().min(1).max(1000).optional(),
})
export type ClassSubjectBody = z.infer<typeof classSubjectBodySchema>

export const classSubjectUpdateSchema = z
  .object({
    isCompulsory: z.boolean().optional(),
    // null explicitly clears the max score.
    maxScore: z
      .union([z.coerce.number().int().min(1).max(1000), z.null()])
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type ClassSubjectUpdate = z.infer<typeof classSubjectUpdateSchema>

// ---------------------------------------------------------------------------
// Teacher <-> Subject (which subjects a teacher can teach)
// ---------------------------------------------------------------------------
export const teacherSubjectBodySchema = z.object({
  teacherId: uuidSchema,
  subjectId: uuidSchema,
})
export type TeacherSubjectBody = z.infer<typeof teacherSubjectBodySchema>

export const teacherSubjectListQuerySchema = z.object({
  teacherId: uuidSchema,
})
export type TeacherSubjectListQuery = z.infer<
  typeof teacherSubjectListQuerySchema
>

// ---------------------------------------------------------------------------
// Teacher class assignments (teacher + class/[section] + subject + session)
// ---------------------------------------------------------------------------
export const teacherAssignmentCreateSchema = z.object({
  teacherId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema.optional(),
  subjectId: uuidSchema,
  sessionId: uuidSchema,
  isPrimaryTeacher: z.boolean().optional(),
})
export type TeacherAssignmentCreate = z.infer<
  typeof teacherAssignmentCreateSchema
>

export const teacherAssignmentListQuerySchema = z.object({
  teacherId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
})
export type TeacherAssignmentListQuery = z.infer<
  typeof teacherAssignmentListQuerySchema
>

// Backwards-compatible alias retained from the Phase 1 foundation.
export const academicSessionSchema = academicSessionCreateSchema
