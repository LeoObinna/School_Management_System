import { describe, expect, it } from 'vitest'
import {
  applicationCreateSchema,
  applicationUpdateSchema,
  applicationListQuerySchema,
  applicationReviewSchema,
  applicationDecisionSchema,
  applicationWaitlistSchema,
  applicationEnrollSchema,
  assessmentCreateSchema,
  assessmentUpdateSchema,
  documentTypeSchema,
} from '../schemas/admissions'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('applicationCreateSchema', () => {
  it('accepts a minimal application with only names', () => {
    const result = applicationCreateSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing required name', () => {
    expect(
      applicationCreateSchema.safeParse({ firstName: 'Ada' }).success,
    ).toBe(false)
  })

  it('accepts the full intake payload', () => {
    const result = applicationCreateSchema.safeParse({
      sessionId: uuid,
      intendedClassId: uuid,
      firstName: 'Ada',
      lastName: 'Lovelace',
      otherNames: 'Augusta',
      gender: 'female',
      dateOfBirth: '2015-12-10',
      nationality: 'British',
      guardianName: 'Ann Byron',
      guardianPhone: '+44 20 1234 5678',
      guardianEmail: 'Guardian@Example.COM',
      address: '17 London Road',
      previousSchool: 'St Mary Primary',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // emailSchema normalizes to lower case.
      expect(result.data.guardianEmail).toBe('guardian@example.com')
    }
  })

  it('rejects a malformed guardian email and bad uuid/date', () => {
    expect(
      applicationCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        guardianEmail: 'not-an-email',
      }).success,
    ).toBe(false)
    expect(
      applicationCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        sessionId: 'nope',
      }).success,
    ).toBe(false)
    expect(
      applicationCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        dateOfBirth: '10/12/2015',
      }).success,
    ).toBe(false)
  })
})

describe('applicationUpdateSchema', () => {
  it('rejects an empty update', () => {
    expect(applicationUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial update', () => {
    expect(
      applicationUpdateSchema.safeParse({ guardianPhone: '07123' }).success,
    ).toBe(true)
  })
})

describe('applicationListQuerySchema', () => {
  it('defaults pagination', () => {
    const result = applicationListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.perPage).toBe(20)
    }
  })

  it('rejects an unknown status', () => {
    expect(
      applicationListQuerySchema.safeParse({ status: 'graduated' }).success,
    ).toBe(false)
  })

  it('accepts a valid status and filters', () => {
    const result = applicationListQuerySchema.safeParse({
      status: 'under_review',
      sessionId: uuid,
      search: 'ada',
    })
    expect(result.success).toBe(true)
  })
})

describe('workflow schemas', () => {
  it('review notes are optional', () => {
    expect(applicationReviewSchema.safeParse({}).success).toBe(true)
  })

  it('decision notes are required for approve/reject', () => {
    expect(applicationDecisionSchema.safeParse({}).success).toBe(false)
    expect(
      applicationDecisionSchema.safeParse({ decisionNotes: 'Seat available' })
        .success,
    ).toBe(true)
  })

  it('waitlist notes are optional', () => {
    expect(applicationWaitlistSchema.safeParse({}).success).toBe(true)
  })
})

describe('assessment schemas', () => {
  it('requires a title', () => {
    expect(assessmentCreateSchema.safeParse({}).success).toBe(false)
    expect(
      assessmentCreateSchema.safeParse({ title: 'Entrance interview' })
        .success,
    ).toBe(true)
  })

  it('validates enums and ISO scheduling', () => {
    expect(
      assessmentCreateSchema.safeParse({
        title: 'Exam',
        assessmentType: 'exam',
        scheduledAt: '2026-09-20T09:00:00.000Z',
        result: 'pass',
      }).success,
    ).toBe(true)
    expect(
      assessmentCreateSchema.safeParse({
        title: 'Exam',
        assessmentType: 'oral',
      }).success,
    ).toBe(false)
    expect(
      assessmentCreateSchema.safeParse({
        title: 'Exam',
        scheduledAt: 'next monday',
      }).success,
    ).toBe(false)
    expect(
      assessmentCreateSchema.safeParse({ title: 'Exam', result: 'maybe' })
        .success,
    ).toBe(false)
  })

  it('update requires at least one field', () => {
    expect(assessmentUpdateSchema.safeParse({}).success).toBe(false)
    expect(
      assessmentUpdateSchema.safeParse({ score: '84/100' }).success,
    ).toBe(true)
  })
})

describe('documentTypeSchema', () => {
  it('requires a non-empty type', () => {
    expect(documentTypeSchema.safeParse('').success).toBe(false)
    expect(documentTypeSchema.safeParse('Birth certificate').success).toBe(
      true,
    )
  })
})

describe('applicationEnrollSchema', () => {
  const valid = {
    admissionNumber: 'STU-2026-009',
    sessionId: uuid,
    classId: uuid,
    enrollmentDate: '2026-09-14',
  }

  it('accepts the minimal conversion payload', () => {
    expect(applicationEnrollSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional section, term, roll number and guardian flag', () => {
    expect(
      applicationEnrollSchema.safeParse({
        ...valid,
        sectionId: uuid,
        termId: uuid,
        rollNumber: '12',
        createGuardianParent: true,
      }).success,
    ).toBe(true)
  })

  it('requires admission number, session, class and date', () => {
    expect(applicationEnrollSchema.safeParse({}).success).toBe(false)
    expect(
      applicationEnrollSchema.safeParse({ ...valid, admissionNumber: '' })
        .success,
    ).toBe(false)
    expect(
      applicationEnrollSchema.safeParse({ ...valid, sessionId: 'no' })
        .success,
    ).toBe(false)
  })

  it('rejects a malformed enrollment date', () => {
    expect(
      applicationEnrollSchema.safeParse({
        ...valid,
        enrollmentDate: '14/09/2026',
      }).success,
    ).toBe(false)
  })
})
