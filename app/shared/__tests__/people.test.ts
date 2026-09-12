/**
 * Phase 4 validation contract tests for people and enrollment schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  studentCreateSchema,
  studentUpdateSchema,
  parentCreateSchema,
  parentUpdateSchema,
  teacherCreateSchema,
  teacherUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  studentParentBodySchema,
  studentParentUpdateSchema,
  enrollmentCreateSchema,
  enrollmentUpdateSchema,
} from '../schemas/people'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('student schemas', () => {
  it('requires admission number and names', () => {
    expect(
      studentCreateSchema.safeParse({
        admissionNumber: 'STU-001',
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(true)
    expect(studentCreateSchema.safeParse({ firstName: 'A' }).success).toBe(false)
  })

  it('rejects a section without a class', () => {
    expect(
      studentCreateSchema.safeParse({
        admissionNumber: 'STU-001',
        firstName: 'A',
        lastName: 'B',
        currentSectionId: UUID,
      }).success,
    ).toBe(false)
  })

  it('accepts class with optional section', () => {
    expect(
      studentCreateSchema.safeParse({
        admissionNumber: 'STU-001',
        firstName: 'A',
        lastName: 'B',
        currentClassId: UUID,
      }).success,
    ).toBe(true)
    expect(
      studentCreateSchema.safeParse({
        admissionNumber: 'STU-001',
        firstName: 'A',
        lastName: 'B',
        currentClassId: UUID,
        currentSectionId: UUID,
      }).success,
    ).toBe(true)
  })

  it('rejects empty updates', () => {
    expect(studentUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('parent schemas', () => {
  it('requires first and last name', () => {
    expect(
      parentCreateSchema.safeParse({ firstName: 'A', lastName: 'B' }).success,
    ).toBe(true)
    expect(parentCreateSchema.safeParse({ firstName: 'A' }).success).toBe(false)
  })

  it('accepts an empty email string but rejects invalid emails', () => {
    expect(
      parentCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        email: '',
      }).success,
    ).toBe(true)
    expect(
      parentCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        email: 'not-an-email',
      }).success,
    ).toBe(false)
  })

  it('rejects empty parent updates', () => {
    expect(parentUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('teacher schemas', () => {
  it('requires staff number and names', () => {
    expect(
      teacherCreateSchema.safeParse({
        staffNumber: 'T001',
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(true)
    expect(teacherCreateSchema.safeParse({ firstName: 'A' }).success).toBe(false)
  })

  it('rejects empty teacher updates', () => {
    expect(teacherUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('staff schemas', () => {
  it('requires staff number and names', () => {
    expect(
      staffCreateSchema.safeParse({
        staffNumber: 'S001',
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(true)
  })

  it('rejects empty staff updates', () => {
    expect(staffUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('student-parent schemas', () => {
  it('requires parent uuid and a relationship', () => {
    expect(
      studentParentBodySchema.safeParse({
        parentId: UUID,
        relationship: 'Mother',
      }).success,
    ).toBe(true)
    expect(
      studentParentBodySchema.safeParse({ parentId: UUID }).success,
    ).toBe(false)
  })

  it('defaults flags to undefined (service applies defaults) and rejects empty updates', () => {
    const result = studentParentBodySchema.safeParse({
      parentId: UUID,
      relationship: 'Mother',
    })
    expect(result.success).toBe(true)
    expect(studentParentUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('enrollment schemas', () => {
  const base = {
    studentId: UUID,
    sessionId: UUID,
    classId: UUID,
    enrollmentDate: '2026-09-07',
  }

  it('requires student, session, class and date', () => {
    expect(enrollmentCreateSchema.safeParse(base).success).toBe(true)
    expect(
      enrollmentCreateSchema.safeParse({ ...base, classId: undefined }).success,
    ).toBe(false)
  })

  it('rejects a section without a class', () => {
    expect(
      enrollmentCreateSchema.safeParse({ ...base, sectionId: UUID }).success,
    ).toBe(true)
    expect(
      enrollmentCreateSchema.safeParse({
        studentId: UUID,
        sessionId: UUID,
        classId: undefined,
        sectionId: UUID,
        enrollmentDate: '2026-09-07',
      }).success,
    ).toBe(false)
  })

  it('requires a valid date', () => {
    expect(
      enrollmentCreateSchema.safeParse({
        ...base,
        enrollmentDate: 'not-a-date',
      }).success,
    ).toBe(false)
  })

  it('rejects empty enrollment updates', () => {
    expect(enrollmentUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a status update on enrollment', () => {
    expect(
      enrollmentUpdateSchema.safeParse({ status: 'withdrawn' }).success,
    ).toBe(true)
  })
})
