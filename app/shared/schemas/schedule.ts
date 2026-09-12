/**
 * Timetable + attendance validation schemas (README §15–16, Phase 5).
 *
 * Timetable entries place a subject/teacher in a class (optionally a
 * section) for a weekday/time slot within a session (optionally a
 * term). Attendance sessions are daily marking events for a class/
 * section; records are one row per student with status
 * present/absent/late/excused.
 */
import { z } from 'zod'
import {
  dateStringSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

// Mirrors database/schema/enums.ts weekdayEnum.
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'excused',
] as const

export const ATTENDANCE_SESSION_STATUSES = [
  'open',
  'submitted',
  'approved',
] as const

// Postgres `time` values arrive as "HH:MM" or "HH:MM:SS".
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Expected a HH:MM time')

// ---------------------------------------------------------------------------
// Timetable entries
// ---------------------------------------------------------------------------
const timetableBaseSchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
  subjectId: uuidSchema,
  teacherId: uuidSchema,
  room: z.string().trim().min(1).max(100).nullable().optional(),
  weekday: z.enum(WEEKDAYS),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
})

// A section belongs to a class and the slot must have positive length.
const timetableShapeRule = {
  message: 'endTime must be after startTime.',
  path: ['endTime'],
}

const sectionRule = {
  message: 'classId is required when sectionId is provided.',
  path: ['classId'],
}

export const timetableCreateSchema = timetableBaseSchema
  .refine((d) => d.endTime > d.startTime, timetableShapeRule)
  .refine(
    (d) => d.sectionId === undefined || d.sectionId === null || !!d.classId,
    sectionRule,
  )
export type TimetableCreate = z.infer<typeof timetableCreateSchema>

// Updates allow explicit null to clear term/section/room. The merge with
// the existing row happens in the service, so cross-field refines only
// apply when both fields are present in the payload.
export const timetableUpdateSchema = z
  .object({
    sessionId: uuidSchema.optional(),
    termId: uuidSchema.nullable().optional(),
    classId: uuidSchema.optional(),
    sectionId: uuidSchema.nullable().optional(),
    subjectId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    room: z.string().trim().min(1).max(100).nullable().optional(),
    weekday: z.enum(WEEKDAYS).optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
  .refine(
    (d) =>
      d.startTime === undefined ||
      d.endTime === undefined ||
      d.endTime > d.startTime,
    timetableShapeRule,
  )
  .refine(
    (d) =>
      d.sectionId === undefined ||
      d.sectionId === null ||
      d.classId !== undefined,
    sectionRule,
  )
export type TimetableUpdate = z.infer<typeof timetableUpdateSchema>

export const timetableListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  teacherId: uuidSchema.optional(),
  weekday: z.enum(WEEKDAYS).optional(),
})
export type TimetableListQuery = z.infer<typeof timetableListQuerySchema>

// ---------------------------------------------------------------------------
// Attendance sessions
// ---------------------------------------------------------------------------
const attendanceSessionBaseSchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  classId: uuidSchema,
  sectionId: uuidSchema.nullable().optional(),
  date: dateStringSchema,
  notes: z.string().trim().max(5000).nullable().optional(),
})

export const attendanceSessionCreateSchema = attendanceSessionBaseSchema.refine(
  (d) => d.sectionId === undefined || d.sectionId === null || !!d.classId,
  sectionRule,
)
export type AttendanceSessionCreate = z.infer<
  typeof attendanceSessionCreateSchema
>

export const attendanceSessionUpdateSchema = z
  .object({
    notes: z.string().trim().max(5000).nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type AttendanceSessionUpdate = z.infer<
  typeof attendanceSessionUpdateSchema
>

export const attendanceSessionListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  status: z.enum(ATTENDANCE_SESSION_STATUSES).optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
})
export type AttendanceSessionListQuery = z.infer<
  typeof attendanceSessionListQuerySchema
>

// ---------------------------------------------------------------------------
// Attendance records (daily marking)
// ---------------------------------------------------------------------------
export const attendanceRecordBodySchema = z.object({
  studentId: uuidSchema,
  status: z.enum(ATTENDANCE_STATUSES),
  remark: z.string().trim().max(255).nullable().optional(),
})
export type AttendanceRecordBody = z.infer<typeof attendanceRecordBodySchema>

export const attendanceMarkBodySchema = z.object({
  records: z.array(attendanceRecordBodySchema).min(1).max(300),
})
export type AttendanceMarkBody = z.infer<typeof attendanceMarkBodySchema>

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const attendanceReportQuerySchema = z.object({
  sessionId: uuidSchema,
  classId: uuidSchema,
  termId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
})
export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>

export const studentAttendanceQuerySchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema.optional(),
})
export type StudentAttendanceQuery = z.infer<
  typeof studentAttendanceQuerySchema
>
