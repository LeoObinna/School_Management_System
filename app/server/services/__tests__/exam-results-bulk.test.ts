/**
 * Phase 16D multi-subject CSV bulk exam-score entry: pure per-row
 * validation matrix + the pre-DB actor guard. DB composition is thin
 * and exercised via cf:dev smoke (per the Phase 16 plan).
 */
import { describe, expect, it } from 'vitest'
import {
  requireEnterActor,
  validateScoreCsvRows,
  type ScoreCsvRefData,
} from '../exam-results-bulk'
import type { Actor } from '../exams'

function refData(
  overrides: Partial<ScoreCsvRefData> = {},
): ScoreCsvRefData {
  return {
    exam: {
      id: 'exam-1',
      name: 'First Term Examination',
      className: 'JSS 1A',
      sessionId: 'session-1',
      termId: 'term-1',
      classId: 'class-1',
      status: 'open',
    },
    examSubjects: [
      {
        id: 'es-1',
        subjectId: 'subj-1',
        code: 'MTH',
        name: 'Mathematics',
        maxScore: 10000, // 100.00
      },
      {
        id: 'es-2',
        subjectId: 'subj-2',
        code: 'ENG',
        name: 'English',
        maxScore: 10000,
      },
    ],
    enrollments: [
      {
        studentId: 'stud-1',
        admissionNumber: 'VCS/001',
        studentName: 'Ada Obi',
        sectionId: 'sec-1',
      },
      {
        studentId: 'stud-2',
        admissionNumber: 'VCS/002',
        studentName: 'Bola Ade',
        sectionId: null,
      },
    ],
    // subj-1 covers every section (null); subj-2 only sec-2.
    assignmentsBySubject: new Map([
      ['subj-1', [null]],
      ['subj-2', ['sec-2']],
    ]),
    isAdmin: false,
    scaleItems: [
      { grade: 'A', minScore: '80.00', maxScore: '100.00' },
      { grade: 'B', minScore: '70.00', maxScore: '79.99' },
      { grade: 'C', minScore: '0.00', maxScore: '69.99' },
    ],
    ...overrides,
  }
}

function row(
  admissionNumber: string,
  subjectCode: string,
  score: string,
): { admissionNumber: string; subjectCode: string; score: string } {
  return { admissionNumber, subjectCode, score }
}

describe('validateScoreCsvRows', () => {
  it('accepts valid rows with resolved student, subject and grade', () => {
    const result = validateScoreCsvRows(
      [row('VCS/001', 'MTH', '75'), row('VCS/002', 'MTH', '85')],
      refData(),
    )
    expect(result.every((r) => r.ok)).toBe(true)
    expect(result[0]!.studentId).toBe('stud-1')
    expect(result[0]!.studentName).toBe('Ada Obi')
    expect(result[0]!.examSubjectId).toBe('es-1')
    expect(result[0]!.subjectName).toBe('Mathematics')
    expect(result[0]!.maxScore).toBe('100.00')
    expect(result[0]!.grade).toBe('B') // 75 → B
    expect(result[1]!.grade).toBe('A') // 85 → A
  })

  it('rejects unknown admission numbers, subjects and missing cells', () => {
    const result = validateScoreCsvRows(
      [
        row('VCS/999', 'MTH', '75'),
        row('VCS/001', 'PHY', '75'),
        row('', 'MTH', '75'),
        row('VCS/001', '', '75'),
        row('VCS/001', 'MTH', ''),
      ],
      refData(),
    )
    expect(result.map((r) => r.error)).toEqual([
      expect.stringContaining('No actively enrolled student'),
      expect.stringContaining('is not part of this exam'),
      'Missing admission number.',
      'Missing subject code.',
      'Missing score.',
    ])
  })

  it('rejects malformed, negative and over-max scores', () => {
    const result = validateScoreCsvRows(
      [row('VCS/001', 'MTH', 'abc'), row('VCS/001', 'MTH', '-5'), row('VCS/001', 'MTH', '120.5')],
      refData(),
    )
    expect(result[0]!.error).toBe('Score must be a number like 75 or 75.5.')
    expect(result[1]!.error).toBe('Score cannot be negative.')
    expect(result[2]!.error).toBe('Score cannot exceed 100.00.')
  })

  it('flags later duplicates against the first occurrence', () => {
    const result = validateScoreCsvRows(
      [row('VCS/001', 'MTH', '75'), row('VCS/001', 'MTH', '90')],
      refData(),
    )
    expect(result[0]!.ok).toBe(true)
    expect(result[1]!.ok).toBe(false)
    expect(result[1]!.error).toBe('Duplicate of row 1.')
  })

  it('enforces per-subject assignment scoped to the section', () => {
    // VCS/001 sits in sec-1; the teacher is assigned to ENG only for sec-2.
    const result = validateScoreCsvRows(
      [row('VCS/001', 'ENG', '75'), row('VCS/002', 'ENG', '75')],
      refData(),
    )
    expect(result[0]!.error).toBe('You are not assigned to teach this subject.')
    expect(result[1]!.ok).toBe(true) // sectionless student matches any section
  })

  it('lets admins skip the assignment check', () => {
    const result = validateScoreCsvRows(
      [row('VCS/001', 'ENG', '75')],
      refData({ isAdmin: true, assignmentsBySubject: new Map() }),
    )
    expect(result[0]!.ok).toBe(true)
  })

  it('matches subject codes exactly after trimming', () => {
    const result = validateScoreCsvRows(
      [row('VCS/001', ' mth ', '75'), row('VCS/001', 'MTHS', '75')],
      refData(),
    )
    expect(result[0]!.error).toBe('Subject code mth is not part of this exam.')
    expect(result[1]!.error).toBe('Subject code MTHS is not part of this exam.')
  })
})

describe('requireEnterActor guard', () => {
  it('403s non-admins without a linked teacher profile', () => {
    const actor: Actor = {
      userId: 'user-1',
      isStaff: true,
      isAdmin: false,
      teacherId: null,
      studentId: null,
    }
    expect(() => requireEnterActor(actor)).toThrow(
      'Only assigned teachers or admins can enter exam scores.',
    )
  })

  it('returns the teacherId for non-admin teachers and bypasses admins', () => {
    const teacher: Actor = {
      userId: 'user-2',
      isStaff: true,
      isAdmin: false,
      teacherId: 'teacher-1',
      studentId: null,
    }
    expect(requireEnterActor(teacher)).toEqual({
      isAdmin: false,
      teacherId: 'teacher-1',
    })
    const admin: Actor = {
      userId: 'user-3',
      isStaff: true,
      isAdmin: true,
      teacherId: null,
      studentId: null,
    }
    expect(requireEnterActor(admin)).toEqual({ isAdmin: true, teacherId: null })
  })
})
