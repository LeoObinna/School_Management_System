/**
 * Academic structure validation schemas (README §11).
 *
 * These back the admin CRUD for sessions, terms, classes, sections and
 * subjects. Business rules (date ordering, overlap) are enforced; school
 * policy values are supplied as data, never hard-coded.
 */
import { z } from 'zod'
import { dateStringSchema, nameSchema } from './common'

export const academicSessionSchema = z
  .object({
    name: nameSchema,
    shortName: z.string().trim().min(1).max(20),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    isCurrent: z.boolean().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })
export type AcademicSessionInput = z.infer<typeof academicSessionSchema>

export const termSchema = z
  .object({
    sessionId: z.string().uuid(),
    name: nameSchema,
    shortName: z.string().trim().min(1).max(20),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    sequence: z.coerce.number().int().min(1),
    isCurrent: z.boolean().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })
export type TermInput = z.infer<typeof termSchema>

export const classSchema = z.object({
  name: nameSchema,
  shortName: z.string().trim().min(1).max(20),
  level: z.coerce.number().int().min(0).max(20).optional(),
  capacity: z.coerce.number().int().min(0).max(10000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})
export type ClassInput = z.infer<typeof classSchema>

export const sectionSchema = z.object({
  classId: z.string().uuid(),
  name: nameSchema,
  capacity: z.coerce.number().int().min(0).max(10000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})
export type SectionInput = z.infer<typeof sectionSchema>

export const subjectSchema = z.object({
  name: nameSchema,
  shortName: z.string().trim().min(1).max(20),
  code: z.string().trim().max(30).optional(),
  type: z.enum(['core', 'elective']).default('core'),
})
export type SubjectInput = z.infer<typeof subjectSchema>
