/**
 * Phase 7 validation contract tests: teacher self-service query schemas.
 * These endpoints never accept a teacherId from the client (the actor
 * resolver fills it server-side), so the schemas only validate the
 * optional filters the teacher is allowed to narrow further.
 */
import { describe, it, expect } from 'vitest'
import {
  myStudentListQuerySchema,
  submissionsToGradeQuerySchema,
} from '../schemas/teachers'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('myStudentListQuerySchema', () => {
  it('accepts an empty query and fills pagination defaults', () => {
    const parsed = myStudentListQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.perPage).toBe(20)
    expect(parsed.order).toBe('asc')
    expect(parsed.classId).toBeUndefined()
    expect(parsed.search).toBeUndefined()
  })

  it('accepts a valid classId filter', () => {
    const parsed = myStudentListQuerySchema.parse({ classId: UUID })
    expect(parsed.classId).toBe(UUID)
  })

  it('rejects a non-UUID classId', () => {
    expect(
      myStudentListQuerySchema.safeParse({ classId: 'not-a-uuid' }).success,
    ).toBe(false)
  })

  it('coerces numeric page/perPage strings', () => {
    const parsed = myStudentListQuerySchema.parse({
      page: '3',
      perPage: '50',
    })
    expect(parsed.page).toBe(3)
    expect(parsed.perPage).toBe(50)
  })

  it('rejects page < 1 and perPage > 100', () => {
    expect(myStudentListQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(
      myStudentListQuerySchema.safeParse({ perPage: 101 }).success,
    ).toBe(false)
  })

  it('trims the search term and rejects overly long input', () => {
    const parsed = myStudentListQuerySchema.parse({ search: '  ada  ' })
    expect(parsed.search).toBe('ada')
    expect(
      myStudentListQuerySchema.safeParse({ search: 'x'.repeat(256) }).success,
    ).toBe(false)
  })
})

describe('submissionsToGradeQuerySchema', () => {
  it('accepts an empty query (status defaults to submitted/late server-side)', () => {
    const parsed = submissionsToGradeQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.status).toBeUndefined()
    expect(parsed.classId).toBeUndefined()
    expect(parsed.subjectId).toBeUndefined()
  })

  it('accepts valid class/subject filters and a known status', () => {
    const parsed = submissionsToGradeQuerySchema.parse({
      classId: UUID,
      subjectId: UUID,
      status: 'late',
    })
    expect(parsed.classId).toBe(UUID)
    expect(parsed.subjectId).toBe(UUID)
    expect(parsed.status).toBe('late')
  })

  it('accepts every submission status enum value', () => {
    for (const status of ['draft', 'submitted', 'late', 'graded', 'returned']) {
      expect(
        submissionsToGradeQuerySchema.safeParse({ status }).success,
      ).toBe(true)
    }
  })

  it('rejects an unknown status and non-UUID filters', () => {
    expect(
      submissionsToGradeQuerySchema.safeParse({ status: 'bogus' }).success,
    ).toBe(false)
    expect(
      submissionsToGradeQuerySchema.safeParse({ classId: 'x' }).success,
    ).toBe(false)
    expect(
      submissionsToGradeQuerySchema.safeParse({ subjectId: 'x' }).success,
    ).toBe(false)
  })
})
