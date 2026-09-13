/**
 * Unit tests for Phase 7 shared validation schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  assessmentTypeCreateSchema,
  assessmentTypeUpdateSchema,
  examCreateSchema,
  examUpdateSchema,
  examSubjectUpsertSchema,
  examScoreBulkSchema,
  assessmentScoreBulkSchema,
  gradingScaleCreateSchema,
  gradingScaleUpdateSchema,
  reportCardGenerateSchema,
  resultPublicationCreateSchema,
} from '../schemas/exams'

const uuid = '11111111-1111-4111-8111-111111111111'

// ---------------------------------------------------------------------------
// Assessment types
// ---------------------------------------------------------------------------
describe('assessmentTypeCreateSchema', () => {
  const valid = { name: 'Midterm', slug: 'midterm' }

  it('accepts a minimal assessment type', () => {
    expect(assessmentTypeCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(
      assessmentTypeCreateSchema.safeParse({ ...valid, name: '  ' }).success,
    ).toBe(false)
  })

  it('accepts an optional weight and rejects out-of-range weight', () => {
    expect(
      assessmentTypeCreateSchema.safeParse({ ...valid, weight: '40.5' })
        .success,
    ).toBe(true)
    expect(
      assessmentTypeCreateSchema.safeParse({ ...valid, weight: 'abc' })
        .success,
    ).toBe(false)
  })

  it('accepts an isActive flag', () => {
    const result = assessmentTypeCreateSchema.safeParse({
      ...valid,
      isActive: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(false)
    }
  })
})

describe('assessmentTypeUpdateSchema', () => {
  it('rejects an empty update', () => {
    expect(assessmentTypeUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial update', () => {
    expect(
      assessmentTypeUpdateSchema.safeParse({ name: 'Updated' }).success,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Grading scales
// ---------------------------------------------------------------------------
const validItems = [
  { grade: 'A', minScore: '70', maxScore: '100' },
  { grade: 'B', minScore: '60', maxScore: '69.99' },
  { grade: 'C', minScore: '50', maxScore: '59.99' },
  { grade: 'F', minScore: '0', maxScore: '49.99' },
]

describe('gradingScaleCreateSchema', () => {
  const valid = { name: 'Default', items: validItems }

  it('accepts a valid scale with items', () => {
    expect(gradingScaleCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects when items is empty', () => {
    expect(
      gradingScaleCreateSchema.safeParse({ ...valid, items: [] }).success,
    ).toBe(false)
  })

  it('rejects when minScore >= maxScore on any item', () => {
    expect(
      gradingScaleCreateSchema.safeParse({
        ...valid,
        items: [
          { grade: 'A', minScore: '50', maxScore: '50' },
          { grade: 'B', minScore: '0', maxScore: '49.99' },
        ],
      }).success,
    ).toBe(false)
  })

  it('accepts an item with optional points and remark', () => {
    expect(
      gradingScaleCreateSchema.safeParse({
        ...valid,
        items: [
          {
            grade: 'A',
            minScore: '70',
            maxScore: '100',
            remark: 'Excellent',
            points: '4',
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('accepts a nullable sessionId', () => {
    expect(
      gradingScaleCreateSchema.safeParse({ ...valid, sessionId: null })
        .success,
    ).toBe(true)
    expect(
      gradingScaleCreateSchema.safeParse({ ...valid, sessionId: uuid })
        .success,
    ).toBe(true)
  })
})

describe('gradingScaleUpdateSchema', () => {
  it('rejects an empty update', () => {
    expect(gradingScaleUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts updating only name', () => {
    expect(
      gradingScaleUpdateSchema.safeParse({ name: 'Renamed' }).success,
    ).toBe(true)
  })

  it('rejects items with minScore >= maxScore on update', () => {
    expect(
      gradingScaleUpdateSchema.safeParse({
        items: [{ grade: 'X', minScore: '80', maxScore: '80' }],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
describe('examCreateSchema', () => {
  const valid = {
    sessionId: uuid,
    classId: uuid,
    name: 'First Term Exam',
  }

  it('accepts a minimal exam', () => {
    expect(examCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(examCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(
      false,
    )
  })

  it('accepts a nullable termId and ISO dates', () => {
    expect(
      examCreateSchema.safeParse({
        ...valid,
        termId: null,
        startDate: '2026-09-10',
        endDate: '2026-09-20',
      }).success,
    ).toBe(true)
  })

  it('rejects a non-ISO date', () => {
    expect(
      examCreateSchema.safeParse({ ...valid, startDate: '10/09/2026' })
        .success,
    ).toBe(false)
  })

  it('accepts an explicit status from the enum', () => {
    expect(
      examCreateSchema.safeParse({ ...valid, status: 'open' }).success,
    ).toBe(true)
    expect(
      examCreateSchema.safeParse({ ...valid, status: 'invalid' }).success,
    ).toBe(false)
  })
})

describe('examUpdateSchema', () => {
  it('rejects an empty update', () => {
    expect(examUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial update', () => {
    expect(examUpdateSchema.safeParse({ name: 'Updated' }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Exam subjects
// ---------------------------------------------------------------------------
describe('examSubjectUpsertSchema', () => {
  it('accepts a minimal upsert', () => {
    expect(
      examSubjectUpsertSchema.safeParse({ subjectId: uuid }).success,
    ).toBe(true)
  })

  it('accepts maxScore and examDate', () => {
    expect(
      examSubjectUpsertSchema.safeParse({
        subjectId: uuid,
        maxScore: '80',
        examDate: '2026-09-15',
      }).success,
    ).toBe(true)
  })

  it('rejects a negative maxScore', () => {
    expect(
      examSubjectUpsertSchema.safeParse({
        subjectId: uuid,
        maxScore: '-10',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bulk exam scores
// ---------------------------------------------------------------------------
describe('examScoreBulkSchema', () => {
  it('accepts a valid bulk payload', () => {
    expect(
      examScoreBulkSchema.safeParse({
        examSubjectId: uuid,
        scores: [
          { studentId: uuid, score: '85.5' },
          { studentId: uuid, score: '90' },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects an empty scores array', () => {
    expect(
      examScoreBulkSchema.safeParse({
        examSubjectId: uuid,
        scores: [],
      }).success,
    ).toBe(false)
  })

  it('rejects more than 200 rows', () => {
    const scores = Array.from({ length: 201 }, () => ({
      studentId: uuid,
      score: '50',
    }))
    expect(
      examScoreBulkSchema.safeParse({ examSubjectId: uuid, scores }).success,
    ).toBe(false)
  })

  it('rejects a non-numeric score', () => {
    expect(
      examScoreBulkSchema.safeParse({
        examSubjectId: uuid,
        scores: [{ studentId: uuid, score: 'abc' }],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bulk assessment scores
// ---------------------------------------------------------------------------
describe('assessmentScoreBulkSchema', () => {
  it('accepts a valid bulk payload', () => {
    expect(
      assessmentScoreBulkSchema.safeParse({
        subjectId: uuid,
        sessionId: uuid,
        assessmentTypeId: uuid,
        scores: [{ studentId: uuid, score: '15' }],
      }).success,
    ).toBe(true)
  })

  it('rejects a missing assessmentTypeId', () => {
    expect(
      assessmentScoreBulkSchema.safeParse({
        subjectId: uuid,
        sessionId: uuid,
        scores: [{ studentId: uuid, score: '15' }],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Result publications
// ---------------------------------------------------------------------------
describe('resultPublicationCreateSchema', () => {
  it('accepts a valid publication', () => {
    expect(
      resultPublicationCreateSchema.safeParse({
        sessionId: uuid,
        termId: uuid,
        classId: uuid,
      }).success,
    ).toBe(true)
  })

  it('accepts a nullable sectionId', () => {
    expect(
      resultPublicationCreateSchema.safeParse({
        sessionId: uuid,
        termId: uuid,
        classId: uuid,
        sectionId: null,
      }).success,
    ).toBe(true)
  })

  it('rejects a missing termId', () => {
    expect(
      resultPublicationCreateSchema.safeParse({
        sessionId: uuid,
        classId: uuid,
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------
describe('reportCardGenerateSchema', () => {
  it('accepts a valid report card request', () => {
    expect(
      reportCardGenerateSchema.safeParse({
        studentId: uuid,
        sessionId: uuid,
        termId: uuid,
        classId: uuid,
      }).success,
    ).toBe(true)
  })

  it('accepts optional remarks', () => {
    expect(
      reportCardGenerateSchema.safeParse({
        studentId: uuid,
        sessionId: uuid,
        termId: uuid,
        classId: uuid,
        teacherRemark: 'Good progress',
        principalRemark: 'Keep it up',
        attendanceSummary: '95% present',
      }).success,
    ).toBe(true)
  })

  it('rejects a missing classId', () => {
    expect(
      reportCardGenerateSchema.safeParse({
        studentId: uuid,
        sessionId: uuid,
        termId: uuid,
      }).success,
    ).toBe(false)
  })
})
