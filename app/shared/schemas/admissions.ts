/**
 * Admissions validation schemas (README §20, Phase 9).
 *
 * Workflow:
 *   Application -> Documents -> Review -> Assessment/Interview
 *   -> Decision -> Admission -> Enrollment
 *
 * This phase is staff-intake only (no public application form);
 * applicants have no login accounts.
 */
import { z } from 'zod'
import {
  dateStringSchema,
  emailSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

export const ADMISSION_STATUSES = [
  'applied',
  'documents_submitted',
  'under_review',
  'assessment_scheduled',
  'assessed',
  'accepted',
  'rejected',
  'waitlisted',
  'admitted',
  'enrolled',
  'withdrawn',
] as const

export const ASSESSMENT_TYPES = ['exam', 'interview', 'test', 'other'] as const
export const ASSESSMENT_RESULTS = [
  'pass',
  'fail',
  'consider',
] as const

const GENDERS = ['male', 'female', 'other'] as const

const applicationFields = {
  sessionId: uuidSchema.nullable().optional(),
  intendedClassId: uuidSchema.nullable().optional(),
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  otherNames: z.string().trim().max(150).nullish(),
  gender: z.enum(GENDERS).nullish(),
  dateOfBirth: dateStringSchema.nullish(),
  nationality: z.string().trim().max(100).nullish(),
  guardianName: z.string().trim().max(255).nullish(),
  guardianPhone: z.string().trim().max(50).nullish(),
  guardianEmail: emailSchema.nullish(),
  address: z.string().trim().max(2000).nullish(),
  previousSchool: z.string().trim().max(255).nullish(),
}

export const applicationCreateSchema = z.object(applicationFields)
export type ApplicationCreate = z.infer<typeof applicationCreateSchema>

// Applications remain editable until a terminal decision/conversion.
// The service enforces which statuses may be updated.
export const applicationUpdateSchema = z
  .object({
    sessionId: uuidSchema.nullable().optional(),
    intendedClassId: uuidSchema.nullable().optional(),
    firstName: z.string().trim().min(1).max(150).optional(),
    lastName: z.string().trim().min(1).max(150).optional(),
    otherNames: z.string().trim().max(150).nullish(),
    gender: z.enum(GENDERS).nullish(),
    dateOfBirth: dateStringSchema.nullish(),
    nationality: z.string().trim().max(100).nullish(),
    guardianName: z.string().trim().max(255).nullish(),
    guardianPhone: z.string().trim().max(50).nullish(),
    guardianEmail: emailSchema.nullish(),
    address: z.string().trim().max(2000).nullish(),
    previousSchool: z.string().trim().max(255).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type ApplicationUpdate = z.infer<typeof applicationUpdateSchema>

export const applicationListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  intendedClassId: uuidSchema.optional(),
  status: z.enum(ADMISSION_STATUSES).optional(),
})
export type ApplicationListQuery = z.infer<
  typeof applicationListQuerySchema
>

// --- Workflow actions ------------------------------------------------------
export const applicationReviewSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
})
export type ApplicationReview = z.infer<typeof applicationReviewSchema>

export const applicationDecisionSchema = z.object({
  decisionNotes: z.string().trim().min(1).max(5000),
})
export type ApplicationDecision = z.infer<typeof applicationDecisionSchema>

export const applicationWaitlistSchema = z.object({
  decisionNotes: z.string().trim().max(5000).optional(),
})
export type ApplicationWaitlist = z.infer<
  typeof applicationWaitlistSchema
>

// --- Assessments / interviews ---------------------------------------------
export const assessmentCreateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  assessmentType: z.enum(ASSESSMENT_TYPES).optional(),
  scheduledAt: z.string().datetime().nullish(),
  score: z.string().trim().max(50).nullish(),
  result: z.enum(ASSESSMENT_RESULTS).nullish(),
  notes: z.string().trim().max(2000).nullish(),
})
export type AssessmentCreate = z.infer<typeof assessmentCreateSchema>

export const assessmentUpdateSchema = assessmentCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type AssessmentUpdate = z.infer<typeof assessmentUpdateSchema>

// --- Documents -------------------------------------------------------------
// The file itself arrives as multipart/form-data; documentType is a
// required text part validated with this schema.
export const documentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
export type DocumentTypeValue = z.infer<typeof documentTypeSchema>

// --- Admission -> enrollment conversion ------------------------------------
export const applicationEnrollSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(50),
  sessionId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
  termId: uuidSchema.nullable().optional(),
  rollNumber: z.string().trim().max(50).nullish(),
  enrollmentDate: dateStringSchema,
  // When true and guardian details exist, also create a parent record
  // and link it to the new student.
  createGuardianParent: z.boolean().optional(),
})
export type ApplicationEnroll = z.infer<typeof applicationEnrollSchema>
