/**
 * Phase 3 validation contract tests: sessions, terms, classes, sections,
 * subjects, class subjects and teacher assignments. These schemas are
 * shared by the client forms and the Nitro API routes.
 */
import { describe, it, expect } from 'vitest'
import {
  academicSessionCreateSchema,
  academicSessionUpdateSchema,
  academicSessionListQuerySchema,
  termCreateSchema,
  termUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  sectionCreateSchema,
  subjectCreateSchema,
  classSubjectBodySchema,
  classSubjectUpdateSchema,
  teacherSubjectBodySchema,
  teacherSubjectListQuerySchema,
  teacherAssignmentCreateSchema,
} from '../schemas/academics'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('academicSession schemas', () => {
  it('accepts a minimal session with just a name', () => {
    const result = academicSessionCreateSchema.safeParse({ name: '2026/2027' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty or too-long name', () => {
    expect(academicSessionCreateSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(
      academicSessionCreateSchema.safeParse({ name: 'x'.repeat(101) }).success,
    ).toBe(false)
  })

  it('rejects an end date before the start date', () => {
    expect(
      academicSessionCreateSchema.safeParse({
        name: '2026/2027',
        startDate: '2026-09-01',
        endDate: '2026-06-01',
      }).success,
    ).toBe(false)
  })

  it('accepts equal start/end dates', () => {
    expect(
      academicSessionCreateSchema.safeParse({
        name: 'X',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      }).success,
    ).toBe(true)
  })

  it('requires at least one field on update', () => {
    expect(academicSessionUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial update', () => {
    const result = academicSessionUpdateSchema.safeParse({ isCurrent: true })
    expect(result.success).toBe(true)
  })

  it('parses boolean query params from strings (including "false")', () => {
    const parsed = academicSessionListQuerySchema.parse({
      isActive: 'false',
      isCurrent: '1',
    })
    expect(parsed.isActive).toBe(false)
    expect(parsed.isCurrent).toBe(true)
  })
})

describe('term schemas', () => {
  const validTerm = {
    sessionId: UUID,
    name: 'First Term',
    sequence: 1,
  }

  it('accepts a valid term', () => {
    expect(termCreateSchema.safeParse(validTerm).success).toBe(true)
  })

  it('requires a uuid session id', () => {
    expect(
      termCreateSchema.safeParse({ ...validTerm, sessionId: 'not-a-uuid' })
        .success,
    ).toBe(false)
  })

  it('rejects sequence below 1', () => {
    expect(
      termCreateSchema.safeParse({ ...validTerm, sequence: 0 }).success,
    ).toBe(false)
  })

  it('coerces a numeric string sequence', () => {
    const result = termCreateSchema.safeParse({
      ...validTerm,
      sequence: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sequence).toBe(2)
    }
  })

  it('rejects inverted term dates', () => {
    expect(
      termCreateSchema.safeParse({
        ...validTerm,
        startDate: '2026-09-01',
        endDate: '2026-01-01',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty update body', () => {
    expect(termUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('class schemas', () => {
  it('accepts a name and optional free-text level', () => {
    expect(classCreateSchema.safeParse({ name: 'JSS 1' }).success).toBe(true)
    expect(
      classCreateSchema.safeParse({ name: 'JSS 1', level: 'junior secondary' })
        .success,
    ).toBe(true)
  })

  it('requires a name', () => {
    expect(classCreateSchema.safeParse({ level: 'jss' }).success).toBe(false)
  })

  it('allows sequence 0', () => {
    expect(classCreateSchema.safeParse({ name: 'N', sequence: 0 }).success).toBe(
      true,
    )
  })

  it('rejects a negative sequence and empty updates', () => {
    expect(
      classCreateSchema.safeParse({ name: 'N', sequence: -1 }).success,
    ).toBe(false)
    expect(classUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('section schemas', () => {
  it('requires a class uuid and a name', () => {
    expect(
      sectionCreateSchema.safeParse({ classId: UUID, name: 'A' }).success,
    ).toBe(true)
    expect(sectionCreateSchema.safeParse({ name: 'A' }).success).toBe(false)
  })

  it('rejects negative or oversized capacity', () => {
    expect(
      sectionCreateSchema.safeParse({ classId: UUID, name: 'A', capacity: -5 })
        .success,
    ).toBe(false)
    expect(
      sectionCreateSchema.safeParse({
        classId: UUID,
        name: 'A',
        capacity: 99999,
      }).success,
    ).toBe(false)
  })

  it('coerces string capacity', () => {
    const result = sectionCreateSchema.safeParse({
      classId: UUID,
      name: 'A',
      capacity: '30',
    })
    expect(result.success).toBe(true)
  })
})

describe('subject schemas', () => {
  it('requires a non-empty name no longer than 150 chars', () => {
    expect(subjectCreateSchema.safeParse({ name: 'Mathematics' }).success).toBe(
      true,
    )
    expect(
      subjectCreateSchema.safeParse({ name: 'x'.repeat(151) }).success,
    ).toBe(false)
  })
})

describe('class subject schemas', () => {
  it('defaults isCompulsory to true', () => {
    const result = classSubjectBodySchema.parse({ subjectId: UUID })
    expect(result.isCompulsory).toBe(true)
  })

  it('coerces maxScore and rejects zero', () => {
    const result = classSubjectBodySchema.safeParse({
      subjectId: UUID,
      maxScore: '100',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxScore).toBe(100)
    }
    expect(
      classSubjectBodySchema.safeParse({ subjectId: UUID, maxScore: 0 })
        .success,
    ).toBe(false)
  })

  it('accepts null maxScore on update to clear it, but not an empty body', () => {
    expect(
      classSubjectUpdateSchema.safeParse({ maxScore: null }).success,
    ).toBe(true)
    expect(classSubjectUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('teacher subject schemas', () => {
  it('requires both teacher and subject uuids', () => {
    expect(
      teacherSubjectBodySchema.safeParse({ teacherId: UUID, subjectId: UUID })
        .success,
    ).toBe(true)
    expect(
      teacherSubjectBodySchema.safeParse({ teacherId: UUID }).success,
    ).toBe(false)
  })

  it('requires teacherId as a list query param', () => {
    expect(
      teacherSubjectListQuerySchema.safeParse({ teacherId: UUID }).success,
    ).toBe(true)
    expect(teacherSubjectListQuerySchema.safeParse({}).success).toBe(false)
  })
})

describe('teacher assignment schemas', () => {
  const validAssignment = {
    teacherId: UUID,
    classId: UUID,
    subjectId: UUID,
    sessionId: UUID,
  }

  it('accepts the four required uuids with an optional section', () => {
    expect(
      teacherAssignmentCreateSchema.safeParse(validAssignment).success,
    ).toBe(true)
    expect(
      teacherAssignmentCreateSchema.safeParse({
        ...validAssignment,
        sectionId: UUID,
      }).success,
    ).toBe(true)
  })

  it('rejects a missing relation id or a non-uuid value', () => {
    expect(
      teacherAssignmentCreateSchema.safeParse({
        classId: UUID,
        subjectId: UUID,
        sessionId: UUID,
      }).success,
    ).toBe(false)
    expect(
      teacherAssignmentCreateSchema.safeParse({
        ...validAssignment,
        classId: 'jss-1',
      }).success,
    ).toBe(false)
  })
})
