/**
 * People + enrollment validation schemas (README §14, Phase 4).
 *
 * Covers students, parents, teachers, staff profiles, student-parent
 * guardian links and student enrollment records. Slugs are not used
 * for people; uniqueness comes from admission/staff numbers (school
 * policy, never hard-coded here). `userId` links a profile to a login
 * account when one exists.
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  dateStringSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

// Shared enum sets (mirrors database/schema/enums.ts).
const STUDENT_STATUSES = [
  'applicant',
  'admitted',
  'enrolled',
  'active',
  'graduated',
  'transferred',
  'withdrawn',
  'archived',
] as const

const ENROLLMENT_STATUSES = [
  'active',
  'completed',
  'promoted',
  'repeated',
  'withdrawn',
] as const

const GENDERS = ['male', 'female', 'other'] as const

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
const studentBaseSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  otherNames: z.string().trim().max(150).optional(),
  gender: z.enum(GENDERS).optional(),
  dateOfBirth: dateStringSchema.optional(),
  bloodGroup: z.string().trim().max(10).optional(),
  nationality: z.string().trim().max(100).optional(),
  religion: z.string().trim().max(100).optional(),
  address: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().max(1000).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  currentClassId: uuidSchema.optional(),
  currentSectionId: uuidSchema.optional(),
  enrolledAt: dateStringSchema.optional(),
})

export const studentCreateSchema = studentBaseSchema.refine(
  (d) =>
    d.currentSectionId === undefined || d.currentClassId !== undefined,
  {
    message: 'currentClassId is required when currentSectionId is provided.',
    path: ['currentClassId'],
  },
)
export type StudentCreate = z.infer<typeof studentCreateSchema>

export const studentUpdateSchema = studentBaseSchema
  .partial()
  .refine(
    (d) =>
      d.currentSectionId === undefined || d.currentClassId !== undefined,
    {
      message: 'currentClassId is required when currentSectionId is provided.',
      path: ['currentClassId'],
    },
  )
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type StudentUpdate = z.infer<typeof studentUpdateSchema>

export const studentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  currentClassId: uuidSchema.optional(),
  search: z.string().trim().max(255).optional(),
})
export type StudentListQuery = z.infer<typeof studentListQuerySchema>

// ---------------------------------------------------------------------------
// Parents / guardians
// ---------------------------------------------------------------------------
const parentBaseSchema = z.object({
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  otherNames: z.string().trim().max(150).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  gender: z.enum(GENDERS).optional(),
  occupation: z.string().trim().max(150).optional(),
  address: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
})

export const parentCreateSchema = parentBaseSchema
export type ParentCreate = z.infer<typeof parentCreateSchema>

export const parentUpdateSchema = parentBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type ParentUpdate = z.infer<typeof parentUpdateSchema>

export const parentListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255).optional(),
  isActive: booleanParamSchema,
})
export type ParentListQuery = z.infer<typeof parentListQuerySchema>

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
const teacherBaseSchema = z.object({
  staffNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  otherNames: z.string().trim().max(150).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  gender: z.enum(GENDERS).optional(),
  qualification: z.string().trim().max(255).optional(),
  specialization: z.string().trim().max(255).optional(),
  address: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().max(1000).optional(),
  hiredAt: dateStringSchema.optional(),
  isActive: z.boolean().optional(),
})

export const teacherCreateSchema = teacherBaseSchema
export type TeacherCreate = z.infer<typeof teacherCreateSchema>

export const teacherUpdateSchema = teacherBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type TeacherUpdate = z.infer<typeof teacherUpdateSchema>

export const teacherListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255).optional(),
  isActive: booleanParamSchema,
})
export type TeacherListQuery = z.infer<typeof teacherListQuerySchema>

// ---------------------------------------------------------------------------
// Staff profiles (non-teaching)
// ---------------------------------------------------------------------------
const staffBaseSchema = z.object({
  staffNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  otherNames: z.string().trim().max(150).optional(),
  jobTitle: z.string().trim().max(150).optional(),
  department: z.string().trim().max(150).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  gender: z.enum(GENDERS).optional(),
  hiredAt: dateStringSchema.optional(),
  isActive: z.boolean().optional(),
})

export const staffCreateSchema = staffBaseSchema
export type StaffCreate = z.infer<typeof staffCreateSchema>

export const staffUpdateSchema = staffBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type StaffUpdate = z.infer<typeof staffUpdateSchema>

export const staffListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255).optional(),
  isActive: booleanParamSchema,
})
export type StaffListQuery = z.infer<typeof staffListQuerySchema>

// ---------------------------------------------------------------------------
// Student <-> Parent link
// ---------------------------------------------------------------------------
export const studentParentBodySchema = z.object({
  parentId: uuidSchema,
  relationship: z.string().trim().min(1).max(50),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
})
export type StudentParentBody = z.infer<typeof studentParentBodySchema>

export const studentParentUpdateSchema = z
  .object({
    relationship: z.string().trim().min(1).max(50).optional(),
    isPrimary: z.boolean().optional(),
    isEmergencyContact: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type StudentParentUpdate = z.infer<typeof studentParentUpdateSchema>

// ---------------------------------------------------------------------------
// Student enrollments
// ---------------------------------------------------------------------------
const enrollmentBaseSchema = z.object({
  studentId: uuidSchema,
  sessionId: uuidSchema,
  termId: uuidSchema.optional(),
  classId: uuidSchema,
  sectionId: uuidSchema.optional(),
  rollNumber: z.string().trim().max(50).optional(),
  enrollmentDate: dateStringSchema,
  status: z.enum(ENROLLMENT_STATUSES).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const enrollmentCreateSchema = enrollmentBaseSchema.refine(
  (d) => d.sectionId === undefined || d.classId !== undefined,
  {
    message: 'classId is required when sectionId is provided.',
    path: ['classId'],
  },
)
export type EnrollmentCreate = z.infer<typeof enrollmentCreateSchema>

export const enrollmentUpdateSchema = z
  .object({
    classId: uuidSchema.optional(),
    sectionId: uuidSchema.optional(),
    rollNumber: z.string().trim().max(50).optional(),
    enrollmentDate: dateStringSchema.optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) => d.sectionId === undefined || d.classId !== undefined,
    {
      message: 'classId is required when sectionId is provided.',
      path: ['classId'],
    },
  )
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type EnrollmentUpdate = z.infer<typeof enrollmentUpdateSchema>

export const enrollmentListQuerySchema = paginationQuerySchema.extend({
  studentId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
})
export type EnrollmentListQuery = z.infer<typeof enrollmentListQuerySchema>
