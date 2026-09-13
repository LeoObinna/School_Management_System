/**
 * Exams, assessments, grading, results and report-card validation
 * schemas (README §18, Phase 7).
 *
 * Grading scale ranges and assessment type weights are configurable data
 * rows — never hard-coded in logic. Scores and ranges use NUMERIC-backed
 * strings; the schema coerces them through zod for safe transport.
 */
import { z } from 'zod'
import {
  paginationQuerySchema,
  uuidSchema,
  dateStringSchema,
} from './common'

// Workflow state shared by result_publications and report_cards.
export const RESULT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'published',
] as const

// Exam open/close lifecycle.
export const EXAM_STATUSES = ['open', 'closed'] as const

// Score payload: NUMERIC values transported as strings to preserve
// precision. Bounded to the schema column's NUMERIC(7,2) range.
const scoreValueSchema = z
  .string()
  .regex(/^-?\d{1,5}(\.\d{1,2})?$/, 'Expected a numeric score')
const maxScoreValueSchema = z
  .string()
  .regex(/^\d{1,5}(\.\d{1,2})?$/, 'Expected a positive numeric max')

// ---------------------------------------------------------------------------
// Assessment types
// ---------------------------------------------------------------------------
const assessmentTypeBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  weight: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Expected a weight between 0 and 100')
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const assessmentTypeCreateSchema = assessmentTypeBaseSchema
export type AssessmentTypeCreate = z.infer<typeof assessmentTypeCreateSchema>

export const assessmentTypeUpdateSchema = assessmentTypeBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type AssessmentTypeUpdate = z.infer<typeof assessmentTypeUpdateSchema>

export const assessmentTypeListQuerySchema = paginationQuerySchema.extend({
  isActive: z.enum(['true', 'false']).optional(),
})
export type AssessmentTypeListQuery = z.infer<
  typeof assessmentTypeListQuerySchema
>

// ---------------------------------------------------------------------------
// Grading scales
// ---------------------------------------------------------------------------
export const gradingScaleItemSchema = z.object({
  grade: z.string().trim().min(1).max(10),
  minScore: maxScoreValueSchema,
  maxScore: maxScoreValueSchema,
  remark: z.string().trim().max(150).nullable().optional(),
  points: scoreValueSchema.optional(),
})

const gradingScaleBaseSchema = z.object({
  sessionId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(150),
  isActive: z.boolean().optional(),
  items: z.array(gradingScaleItemSchema).min(1).max(50),
})

export const gradingScaleCreateSchema = gradingScaleBaseSchema.refine(
  (d) => d.items.every((i) => Number(i.minScore) < Number(i.maxScore)),
  { message: 'Each grade item must have minScore < maxScore.', path: ['items'] },
)
export type GradingScaleCreate = z.infer<typeof gradingScaleCreateSchema>

export const gradingScaleUpdateSchema = gradingScaleBaseSchema
  .partial()
  .extend({
    items: z.array(gradingScaleItemSchema).min(1).max(50).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
  .refine(
    (d) =>
      !d.items ||
      d.items.every((i) => Number(i.minScore) < Number(i.maxScore)),
    { message: 'Each grade item must have minScore < maxScore.', path: ['items'] },
  )
export type GradingScaleUpdate = z.infer<typeof gradingScaleUpdateSchema>

export const gradingScaleListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  isActive: z.enum(['true', 'false']).optional(),
})
export type GradingScaleListQuery = z.infer<typeof gradingScaleListQuerySchema>

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
const examBaseSchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  classId: uuidSchema,
  name: z.string().trim().min(1).max(150),
  startDate: dateStringSchema.nullable().optional(),
  endDate: dateStringSchema.nullable().optional(),
  status: z.enum(EXAM_STATUSES).optional(),
})

export const examCreateSchema = examBaseSchema
export type ExamCreate = z.infer<typeof examCreateSchema>

export const examUpdateSchema = examBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type ExamUpdate = z.infer<typeof examUpdateSchema>

export const examListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  status: z.enum(EXAM_STATUSES).optional(),
})
export type ExamListQuery = z.infer<typeof examListQuerySchema>

// ---------------------------------------------------------------------------
// Exam subjects (subjects attached to an exam with their own max score)
// ---------------------------------------------------------------------------
export const examSubjectUpsertSchema = z.object({
  subjectId: uuidSchema,
  maxScore: maxScoreValueSchema.optional(),
  examDate: dateStringSchema.nullable().optional(),
})
export type ExamSubjectUpsert = z.infer<typeof examSubjectUpsertSchema>

// ---------------------------------------------------------------------------
// Assessment scores (continuous-assessment; per student/subject/term/type)
// ---------------------------------------------------------------------------
export const assessmentScoreUpsertSchema = z.object({
  studentId: uuidSchema,
  subjectId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  assessmentTypeId: uuidSchema,
  score: scoreValueSchema,
  maxScore: maxScoreValueSchema.optional(),
})
export type AssessmentScoreUpsert = z.infer<typeof assessmentScoreUpsertSchema>

export const assessmentScoreBulkSchema = z.object({
  subjectId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  assessmentTypeId: uuidSchema,
  maxScore: maxScoreValueSchema.optional(),
  scores: z
    .array(
      z.object({
        studentId: uuidSchema,
        score: scoreValueSchema,
      }),
    )
    .min(1)
    .max(200),
})
export type AssessmentScoreBulk = z.infer<typeof assessmentScoreBulkSchema>

export const assessmentScoreListQuerySchema = paginationQuerySchema.extend({
  studentId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  assessmentTypeId: uuidSchema.optional(),
})
export type AssessmentScoreListQuery = z.infer<
  typeof assessmentScoreListQuerySchema
>

// ---------------------------------------------------------------------------
// Exam scores (per exam_subject / student)
// ---------------------------------------------------------------------------
export const examScoreUpsertSchema = z.object({
  studentId: uuidSchema,
  score: scoreValueSchema,
})
export type ExamScoreUpsert = z.infer<typeof examScoreUpsertSchema>

export const examScoreBulkSchema = z.object({
  examSubjectId: uuidSchema,
  scores: z
    .array(
      z.object({
        studentId: uuidSchema,
        score: scoreValueSchema,
      }),
    )
    .min(1)
    .max(200),
})
export type ExamScoreBulk = z.infer<typeof examScoreBulkSchema>

// ---------------------------------------------------------------------------
// Result publications (workflow)
// ---------------------------------------------------------------------------
export const resultPublicationCreateSchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
})
export type ResultPublicationCreate = z.infer<
  typeof resultPublicationCreateSchema
>

export const resultPublicationListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  status: z.enum(RESULT_STATUSES).optional(),
})
export type ResultPublicationListQuery = z.infer<
  typeof resultPublicationListQuerySchema
>

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------
export const reportCardGenerateSchema = z.object({
  studentId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
  teacherRemark: z.string().trim().max(5000).nullable().optional(),
  principalRemark: z.string().trim().max(5000).nullable().optional(),
  attendanceSummary: z.string().trim().max(2000).nullable().optional(),
})
export type ReportCardGenerate = z.infer<typeof reportCardGenerateSchema>

export const reportCardListQuerySchema = paginationQuerySchema.extend({
  studentId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  status: z.enum(RESULT_STATUSES).optional(),
})
export type ReportCardListQuery = z.infer<typeof reportCardListQuerySchema>
