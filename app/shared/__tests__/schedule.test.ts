/**
 * Phase 5 validation contract tests for timetable and attendance
 * schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  timetableCreateSchema,
  timetableUpdateSchema,
  attendanceSessionCreateSchema,
  attendanceSessionUpdateSchema,
  attendanceMarkBodySchema,
  attendanceReportQuerySchema,
  studentAttendanceQuerySchema,
} from '../schemas/schedule'

const UUID = '00000000-0000-4000-8000-000000000001'

const validEntry = {
  sessionId: UUID,
  classId: UUID,
  subjectId: UUID,
  teacherId: UUID,
  weekday: 'monday' as const,
  startTime: '08:00',
  endTime: '08:45',
}

describe('timetable schemas', () => {
  it('accepts a valid whole-class entry', () => {
    expect(timetableCreateSchema.safeParse(validEntry).success).toBe(true)
  })

  it('accepts section/term/room when supplied', () => {
    expect(
      timetableCreateSchema.safeParse({
        ...validEntry,
        termId: UUID,
        sectionId: UUID,
        room: 'Lab 1',
      }).success,
    ).toBe(true)
  })

  it('rejects end times at or before the start', () => {
    expect(
      timetableCreateSchema.safeParse({
        ...validEntry,
        startTime: '09:00',
        endTime: '09:00',
      }).success,
    ).toBe(false)
    expect(
      timetableCreateSchema.safeParse({
        ...validEntry,
        startTime: '10:00',
        endTime: '09:00',
      }).success,
    ).toBe(false)
  })

  it('rejects malformed times and weekdays', () => {
    expect(
      timetableCreateSchema.safeParse({ ...validEntry, startTime: '9am' })
        .success,
    ).toBe(false)
    expect(
      timetableCreateSchema.safeParse({ ...validEntry, weekday: 'funday' })
        .success,
    ).toBe(false)
  })

  it('rejects an empty update but accepts partial updates with explicit nulls', () => {
    expect(timetableUpdateSchema.safeParse({}).success).toBe(false)
    expect(
      timetableUpdateSchema.safeParse({ room: null, termId: null }).success,
    ).toBe(true)
  })

  it('rejects a partial update whose times are inverted', () => {
    expect(
      timetableUpdateSchema.safeParse({
        startTime: '11:00',
        endTime: '10:00',
      }).success,
    ).toBe(false)
  })
})

describe('attendance session schemas', () => {
  it('requires session, class and date', () => {
    expect(
      attendanceSessionCreateSchema.safeParse({
        sessionId: UUID,
        classId: UUID,
        date: '2026-09-10',
      }).success,
    ).toBe(true)
    expect(
      attendanceSessionCreateSchema.safeParse({ classId: UUID }).success,
    ).toBe(false)
  })

  it('rejects a bad date', () => {
    expect(
      attendanceSessionCreateSchema.safeParse({
        sessionId: UUID,
        classId: UUID,
        date: '10/09/2026',
      }).success,
    ).toBe(false)
  })

  it('requires at least one field on update', () => {
    expect(attendanceSessionUpdateSchema.safeParse({}).success).toBe(false)
    expect(
      attendanceSessionUpdateSchema.safeParse({ notes: 'Rainy day' }).success,
    ).toBe(true)
  })
})

describe('attendance marking schema', () => {
  it('requires a non-empty records array with valid statuses', () => {
    expect(
      attendanceMarkBodySchema.safeParse({ records: [] }).success,
    ).toBe(false)
    expect(
      attendanceMarkBodySchema.safeParse({
        records: [{ studentId: UUID, status: 'present' }],
      }).success,
    ).toBe(true)
    expect(
      attendanceMarkBodySchema.safeParse({
        records: [{ studentId: UUID, status: 'missing' }],
      }).success,
    ).toBe(false)
  })
})

describe('attendance report schemas', () => {
  it('requires session and class for the class report', () => {
    expect(
      attendanceReportQuerySchema.safeParse({
        sessionId: UUID,
        classId: UUID,
      }).success,
    ).toBe(true)
    expect(
      attendanceReportQuerySchema.safeParse({ sessionId: UUID }).success,
    ).toBe(false)
  })

  it('requires a session for student history', () => {
    expect(
      studentAttendanceQuerySchema.safeParse({ sessionId: UUID }).success,
    ).toBe(true)
    expect(studentAttendanceQuerySchema.safeParse({}).success).toBe(false)
  })
})
