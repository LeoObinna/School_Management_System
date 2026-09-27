/**
 * Phase 16C teacher performance aggregates: the pure aggregation helper
 * (averages/extremes/distribution over published exam-score rows) and
 * the authorization guard that runs before any query.
 */
import { describe, expect, it } from 'vitest'
import {
  aggregateTeacherPerformance,
  getTeacherPerformance,
  type TeacherPerformanceScoreRow,
} from '../teachers-self'
import type { ActorProfile } from '../../utils/auth/actor'

function scoreRow(
  overrides: Partial<TeacherPerformanceScoreRow> = {},
): TeacherPerformanceScoreRow {
  return {
    examId: 'exam-1',
    examName: 'First Term Exam',
    subjectId: 'subj-1',
    subjectName: 'Mathematics',
    maxScore: 10000, // 100.00
    score: 0,
    grade: null,
    ...overrides,
  }
}

describe('aggregateTeacherPerformance', () => {
  it('computes average, extremes and distribution per (exam, subject)', () => {
    const rows = [
      scoreRow({ score: 8000, grade: 'B' }), // 80.00
      scoreRow({ score: 6500, grade: 'C' }), // 65.00
      scoreRow({ score: 9200, grade: 'A' }), // 92.00
    ]
    const result = aggregateTeacherPerformance(rows)
    expect(result).toHaveLength(1)
    const row = result[0]!
    expect(row.studentCount).toBe(3)
    // (8000 + 6500 + 9200) / 3 = 7900 → 79.00
    expect(row.averageScore).toBe('79.00')
    expect(row.highestScore).toBe('92.00')
    expect(row.lowestScore).toBe('65.00')
    expect(row.maxScore).toBe('100.00')
    expect(row.gradeDistribution).toEqual([
      { grade: 'A', count: 1 },
      { grade: 'B', count: 1 },
      { grade: 'C', count: 1 },
    ])
  })

  it('separates groups by exam and subject', () => {
    const rows = [
      scoreRow({ score: 7000 }),
      scoreRow({ examId: 'exam-2', score: 5000 }),
      scoreRow({ subjectId: 'subj-2', subjectName: 'English', score: 9000 }),
    ]
    const result = aggregateTeacherPerformance(rows)
    expect(result).toHaveLength(3)
    expect(
      result.every((r) => r.studentCount === 1 && r.averageScore !== '0.00'),
    ).toBe(true)
  })

  it('skips null grades in the distribution but keeps the score', () => {
    const rows = [scoreRow({ score: 6000, grade: null })]
    const result = aggregateTeacherPerformance(rows)
    expect(result[0]!.averageScore).toBe('60.00')
    expect(result[0]!.gradeDistribution).toEqual([])
  })

  it('returns an empty array for no rows', () => {
    expect(aggregateTeacherPerformance([])).toEqual([])
  })
})

describe('getTeacherPerformance guard', () => {
  const actor = {
    userId: 'user-1',
    isStaff: false,
    isAdmin: false,
    teacherId: null,
    studentId: null,
    staffProfileId: null,
    children: [],
  } satisfies ActorProfile

  it('404s without a linked teacher profile', async () => {
    await expect(
      getTeacherPerformance({ classId: 'class-1' }, actor),
    ).rejects.toThrow('No teacher profile linked to this account.')
  })
})
