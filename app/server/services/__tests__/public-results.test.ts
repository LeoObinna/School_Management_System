/**
 * Phase 18D public result checker service tests.
 *
 * Covers getPublicResult:
 *  - successful published result mapping (safe fields only — no student id)
 *  - generic, indistinguishable 404 for every failure: unknown admission
 *    number, surname mismatch, unknown session, foreign term, missing
 *    active enrollment and non-published publication
 *  - publicResultQuerySchema gates (uuid session/term, non-empty factors)
 *
 * Same chainable-thenable FIFO DB mock as the other service tests.
 * Score aggregation runs through the real aggregateStudentResults core
 * (also backed by the mock), so the mapping between the x100 integer
 * scores and the public decimals is asserted end to end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let resultQueue: unknown[][] = []

vi.mock('../../utils/db', () => {
  const chainable = () => {
    const resolve = () => Promise.resolve(resultQueue.shift() ?? [])
    const chain: Record<string, unknown> = {}
    for (const method of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      chain[method] = () => chain
    }
    chain.then = (onFulfilled: unknown, onRejected: unknown) =>
      resolve().then(onFulfilled as never, onRejected as never)
    chain.catch = (onRejected: unknown) =>
      resolve().catch(onRejected as never)
    chain.finally = (onFinally: unknown) =>
      resolve().finally(onFinally as never)
    return chain
  }
  return {
    db: {
      select: vi.fn().mockImplementation(() => chainable()),
    },
  }
})

import { getPublicResult } from '../public-results'
import { publicResultQuerySchema } from '../../../shared/schemas/public'

const STUDENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TERM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CLASS_ID = '11111111-1111-4111-8111-111111111111'
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222'
const SECTION_ID = '33333333-3333-4333-8333-333333333333'
const ASSESSMENT_TYPE_ID = '44444444-4444-4444-8444-444444444444'

const query = {
  admissionNumber: 'VCS/2024/0007',
  surname: 'Adeyemi',
  sessionId: SESSION_ID,
  termId: TERM_ID,
}

const studentRow = {
  id: STUDENT_ID,
  firstName: 'Tolu',
  lastName: 'Adeyemi',
  admissionNumber: 'VCS/2024/0007',
}
const sessionRow = { name: '2025/2026' }
const termRow = { name: 'Second Term' }
const enrollmentRow = { classId: CLASS_ID, sectionId: SECTION_ID }
const publicationRow = { status: 'published' }
const classRow = { name: 'Primary 4' }

/**
 * Queue for the successful path:
 *   1-6 student, session, term, enrollment, publication, class
 *   aggregateStudentResults:
 *     7. grading scale select (empty → no items query)
 *     8. assessment rows
 *     9. exam rows
 *   10. outer grading scale select (empty)
 */
function queueSuccess(options: { withScore?: boolean } = {}) {
  resultQueue = [
    [studentRow],
    [sessionRow],
    [termRow],
    [enrollmentRow],
    [publicationRow],
    [classRow],
    [], // 7. no active scale
    options.withScore
      ? [
          {
            subjectId: SUBJECT_ID,
            subjectName: 'Mathematics',
            subjectCode: 'MATH',
            assessmentTypeId: ASSESSMENT_TYPE_ID,
            assessmentTypeName: 'Mid-term test',
            // x100 fixed point: 80.00 / 100.00
            score: 8000,
            maxScore: 10000,
          },
        ]
      : [], // 8. assessment rows
    [], // 9. exam rows
    [], // 10. outer scale
  ]
}

beforeEach(() => {
  resultQueue = []
})

describe('public result query schema (18D)', () => {
  it('requires all four factors with uuid session/term', () => {
    expect(publicResultQuerySchema.safeParse(query).success).toBe(true)

    expect(
      publicResultQuerySchema.safeParse({ ...query, admissionNumber: '' })
        .success,
    ).toBe(false)
    expect(
      publicResultQuerySchema.safeParse({ ...query, surname: ' ' }).success,
    ).toBe(false)
    expect(
      publicResultQuerySchema.safeParse({ ...query, sessionId: 'current' })
        .success,
    ).toBe(false)
    expect(
      publicResultQuerySchema.safeParse({ ...query, termId: 'second-term' })
        .success,
    ).toBe(false)
  })
})

describe('getPublicResult (18D)', () => {
  it('maps a published result with scores and no internal ids', async () => {
    queueSuccess({ withScore: true })
    const result = await getPublicResult(query)

    expect(result.studentName).toBe('Tolu Adeyemi')
    expect(result.admissionNumber).toBe('VCS/2024/0007')
    expect(result.sessionName).toBe('2025/2026')
    expect(result.termName).toBe('Second Term')
    expect(result.className).toBe('Primary 4')
    expect(result.subjects).toEqual([
      {
        subjectName: 'Mathematics',
        totalScore: '80.00',
        maxScore: '100.00',
        percentage: '80.00',
        grade: null,
      },
    ])
    expect(result.totalScore).toBe('80.00')
    expect(result.averageScore).toBe('80.00')
    expect(result.overallGrade).toBeNull()

    // Privacy: no student/subject/internal ids or remarks leak.
    expect(result).not.toHaveProperty('studentId')
    expect(result).not.toHaveProperty('sectionId')
    expect(JSON.stringify(result)).not.toContain(STUDENT_ID)
  })

  it('maps an empty published result', async () => {
    queueSuccess()
    const result = await getPublicResult(query)
    expect(result.subjects).toEqual([])
    expect(result.totalScore).toBe('0.00')
    expect(result.averageScore).toBe('0.00')
  })

  it('answers the same generic 404 for every failure mode', async () => {
    const expected = {
      statusCode: 404,
      message: 'No published results match those details.',
    }

    // Unknown admission number
    resultQueue = [[]]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)

    // Surname mismatch (case-insensitive exact gate)
    resultQueue = [[{ ...studentRow, lastName: 'Oyelaran' }]]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)

    // Surname matches case-insensitively, session unknown
    resultQueue = [
      [{ ...studentRow, lastName: 'ADEYEMI' }],
      [],
    ]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)

    // Term not part of the session
    resultQueue = [[studentRow], [sessionRow], []]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)

    // No active enrollment in the session
    resultQueue = [[studentRow], [sessionRow], [termRow], []]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)

    // Publication is draft / missing
    resultQueue = [
      [studentRow],
      [sessionRow],
      [termRow],
      [enrollmentRow],
      [{ status: 'draft' }],
    ]
    await expect(getPublicResult(query)).rejects.toMatchObject(expected)
  })

  it('matches a null section enrollment against a null-section publication', async () => {
    resultQueue = [
      [studentRow],
      [sessionRow],
      [termRow],
      [{ classId: CLASS_ID, sectionId: null }],
      [publicationRow],
      [classRow],
      [], // aggregate scale
      [], // assessments
      [], // exams
      [], // outer scale
    ]
    const result = await getPublicResult(query)
    expect(result.className).toBe('Primary 4')
  })
})
