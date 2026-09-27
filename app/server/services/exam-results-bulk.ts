/**
 * Multi-subject CSV bulk exam-score entry (Phase 16D).
 *
 * The CSV is parsed client-side (shared/utils/csv) into rows of
 * { admissionNumber, subjectCode, score }; these endpoints validate and
 * (for /bulk) commit them. Unlike the single-subject
 * bulkUpsertExamScores path, validation is per-row: one bad line must
 * not fail the whole file, so every failure surfaces as a per-row
 * error in the response and only valid rows are committed.
 *
 * Authorization mirrors the canonical enter path (assertCanEnterForStudent):
 * admins may enter anywhere; teachers only for classes/subjects they are
 * assigned to that session (class-level gate + per-row subject check).
 * The same publication lock applies — once a result_publication leaves
 * `draft`, entry is refused (409).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  classes,
  examScores,
  examSubjects,
  exams,
  studentEnrollments,
  students,
  subjects,
  teacherClassAssignments,
} from '../../database/schema'
import {
  assertScoresUnlocked,
  computeGrade,
  fromScore100,
  getActiveGradingScaleItems,
  toScore100,
} from './exams'
import type { Actor } from './exams'
import {
  smsConflict,
  smsForbidden,
  smsNotFound,
} from '../utils/http-errors'
import {
  chunkRows,
  runBatch,
  type D1BatchItem,
  type SmsDb,
} from '../utils/pagination'
import type { ExamScoreCsvBulk } from '../../shared/schemas'
import type {
  ExamScoreBulkResult,
  ExamScoreBulkRowResult,
} from '../../shared/types'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

/** Everything the per-row validator needs, resolved in one round trip. */
export interface ScoreCsvRefData {
  exam: {
    id: string
    name: string
    className: string
    sessionId: string
    termId: string | null
    classId: string
    status: string
  }
  examSubjects: {
    id: string
    subjectId: string
    code: string | null
    name: string
    maxScore: number
  }[]
  enrollments: {
    studentId: string
    admissionNumber: string
    studentName: string
    sectionId: string | null
  }[]
  /** subjectId → assigned sectionIds; a null entry covers all sections. */
  assignmentsBySubject: Map<string, (string | null)[]>
  isAdmin: boolean
  scaleItems: readonly { minScore: string; maxScore: string; grade: string }[]
}

// Same decimal-string shape as the canonical enter path (scoreValueSchema).
const SCORE_FORMAT = /^-?\d{1,5}(\.\d{1,2})?$/

/**
 * Non-admin callers need a linked teacher profile (assignments are
 * resolved from it); admins bypass. Runs before any DB access.
 */
export function requireEnterActor(
  actor: Actor,
): { isAdmin: true; teacherId: null } | { isAdmin: false; teacherId: string } {
  if (!actor.isAdmin) {
    if (!actor.teacherId) {
      throw smsForbidden(
        'Only assigned teachers or admins can enter exam scores.',
      )
    }
    return { isAdmin: false, teacherId: actor.teacherId }
  }
  return { isAdmin: true, teacherId: null }
}

/**
 * Pure per-row validation (Phase 16D test surface). A later duplicate
 * (admissionNumber, subjectCode) row is rejected pointing at the first
 * occurrence that would be committed; every other failure surfaces as
 * the row's own error.
 */
export function validateScoreCsvRows(
  rows: ExamScoreCsvBulk['rows'],
  ref: ScoreCsvRefData,
): ExamScoreBulkRowResult[] {
  const subjectByCode = new Map(
    ref.examSubjects
      .filter((es) => es.code !== null)
      .map((es) => [es.code, es]),
  )
  const studentByAdmission = new Map(
    ref.enrollments.map((e) => [e.admissionNumber, e]),
  )
  const firstAt = new Map<string, number>()

  return rows.map((row, index) => {
    const rowNumber = index + 1
    const admissionNumber = row.admissionNumber.trim()
    const subjectCode = row.subjectCode.trim()
    const score = row.score.trim()
    const result: ExamScoreBulkRowResult = {
      rowNumber,
      admissionNumber,
      subjectCode,
      score,
      ok: false,
      error: null,
      studentId: null,
      studentName: null,
      examSubjectId: null,
      subjectName: null,
      maxScore: null,
      grade: null,
    }
    const fail = (error: string) => {
      result.error = error
      return result
    }

    if (!admissionNumber) return fail('Missing admission number.')
    if (!subjectCode) return fail('Missing subject code.')
    if (!score) return fail('Missing score.')
    if (!SCORE_FORMAT.test(score)) {
      return fail('Score must be a number like 75 or 75.5.')
    }

    const enrollment = studentByAdmission.get(admissionNumber)
    if (!enrollment) {
      return fail(
        `No actively enrolled student with admission number ${admissionNumber} in this exam's class.`,
      )
    }
    const examSubject = subjectByCode.get(subjectCode)
    if (!examSubject) {
      return fail(`Subject code ${subjectCode} is not part of this exam.`)
    }
    if (!ref.isAdmin) {
      const sections = ref.assignmentsBySubject.get(examSubject.subjectId)
      const assigned =
        sections !== undefined &&
        sections.length > 0 &&
        (enrollment.sectionId === null ||
          sections.includes(null) ||
          sections.includes(enrollment.sectionId))
      if (!assigned) {
        return fail('You are not assigned to teach this subject.')
      }
    }

    const score100 = toScore100(score)
    if (score100 < 0) return fail('Score cannot be negative.')
    if (score100 > examSubject.maxScore) {
      const maxLabel =
        fromScore100(examSubject.maxScore) ?? String(examSubject.maxScore)
      return fail(`Score cannot exceed ${maxLabel}.`)
    }

    // In-file duplicate check runs last so it only guards against rows
    // that would actually be committed — a valid row is never masked by
    // an earlier invalid row sharing the same key.
    const dupKey = `${admissionNumber}|${subjectCode}`
    const first = firstAt.get(dupKey)
    if (first !== undefined) {
      return fail(`Duplicate of row ${first}.`)
    }
    firstAt.set(dupKey, rowNumber)

    const percentage = (score100 / examSubject.maxScore) * 100
    result.ok = true
    result.studentId = enrollment.studentId
    result.studentName = enrollment.studentName
    result.examSubjectId = examSubject.id
    result.subjectName = examSubject.name
    result.maxScore = fromScore100(examSubject.maxScore)
    result.grade = computeGrade(percentage, ref.scaleItems)
    return result
  })
}

function toResult(
  exam: ScoreCsvRefData['exam'],
  rows: ExamScoreBulkRowResult[],
): ExamScoreBulkResult {
  const valid = rows.filter((r) => r.ok).length
  return {
    exam: {
      id: exam.id,
      name: exam.name,
      className: exam.className,
      status: exam.status,
    },
    rows,
    summary: { total: rows.length, valid, invalid: rows.length - valid },
  }
}

/** Shared preconditions + reference-data resolution for both endpoints. */
async function loadRefData(
  client: SmsDb,
  input: ExamScoreCsvBulk,
  actor: Actor,
): Promise<ScoreCsvRefData> {
  const enter = requireEnterActor(actor)

  const [exam] = await client
    .select({
      id: exams.id,
      name: exams.name,
      sessionId: exams.sessionId,
      termId: exams.termId,
      classId: exams.classId,
      status: exams.status,
      className: classes.name,
    })
    .from(exams)
    .innerJoin(classes, eq(exams.classId, classes.id))
    .where(eq(exams.id, input.examId))
    .limit(1)
  if (!exam) {
    throw smsNotFound('Exam not found.')
  }
  if (exam.status !== 'open') {
    throw smsConflict('Exam is not open for entry.')
  }
  await assertScoresUnlocked(client, exam.sessionId, exam.termId, exam.classId)

  const [examSubjectRows, enrollmentRows, assignmentRows, scaleItems] =
    await Promise.all([
      client
        .select({
          id: examSubjects.id,
          subjectId: subjects.id,
          code: subjects.code,
          name: subjects.name,
          maxScore: examSubjects.maxScore,
        })
        .from(examSubjects)
        .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
        .where(eq(examSubjects.examId, exam.id)),
      client
        .select({
          studentId: students.id,
          admissionNumber: students.admissionNumber,
          firstName: students.firstName,
          lastName: students.lastName,
          sectionId: studentEnrollments.sectionId,
        })
        .from(studentEnrollments)
        .innerJoin(students, eq(studentEnrollments.studentId, students.id))
        .where(
          and(
            eq(studentEnrollments.sessionId, exam.sessionId),
            eq(studentEnrollments.classId, exam.classId),
            eq(studentEnrollments.status, 'active'),
            isNull(students.deletedAt),
          ),
        ),
      enter.isAdmin
        ? Promise.resolve([])
        : client
            .select({
              subjectId: teacherClassAssignments.subjectId,
              sectionId: teacherClassAssignments.sectionId,
            })
            .from(teacherClassAssignments)
            .where(
              and(
                eq(teacherClassAssignments.teacherId, enter.teacherId),
                eq(teacherClassAssignments.sessionId, exam.sessionId),
                eq(teacherClassAssignments.classId, exam.classId),
              ),
            ),
      getActiveGradingScaleItems(client, exam.sessionId),
    ])

  const assignmentsBySubject = new Map<string, (string | null)[]>()
  for (const a of assignmentRows) {
    const list = assignmentsBySubject.get(a.subjectId) ?? []
    list.push(a.sectionId)
    assignmentsBySubject.set(a.subjectId, list)
  }
  if (!enter.isAdmin && assignmentsBySubject.size === 0) {
    throw smsForbidden('You are not assigned to this class.')
  }

  return {
    exam,
    examSubjects: examSubjectRows,
    enrollments: enrollmentRows.map((e) => ({
      studentId: e.studentId,
      admissionNumber: e.admissionNumber,
      studentName: `${e.firstName} ${e.lastName}`.trim(),
      sectionId: e.sectionId,
    })),
    assignmentsBySubject,
    isAdmin: enter.isAdmin,
    scaleItems,
  }
}

/** POST /api/v1/exam-results/bulk-preview — validate without writing. */
export async function bulkPreviewExamScores(
  input: ExamScoreCsvBulk,
  actor: Actor,
): Promise<ExamScoreBulkResult> {
  const client = await db()
  const ref = await loadRefData(client, input, actor)
  const rows = validateScoreCsvRows(input.rows, ref)
  return toResult(ref.exam, rows)
}

/**
 * POST /api/v1/exam-results/bulk — re-validate server-side, then commit
 * the valid rows as upserts on (examSubjectId, studentId) inside a
 * single atomic D1 batch (D1 runs batches as implicit transactions).
 */
export async function bulkCommitExamScores(
  input: ExamScoreCsvBulk,
  actor: Actor,
): Promise<ExamScoreBulkResult> {
  const client = await db()
  const ref = await loadRefData(client, input, actor)
  const rows = validateScoreCsvRows(input.rows, ref)
  const valid = rows.filter((r) => r.ok && r.examSubjectId && r.studentId)

  if (valid.length > 0) {
    const values = valid.map((r) => ({
      examSubjectId: r.examSubjectId!,
      studentId: r.studentId!,
      score: toScore100(r.score),
      grade: r.grade,
      enteredById: actor.teacherId,
    }))
    // D1 caps a statement at 100 bound variables (5 per row here → 20
    // rows/statement) and a batch at 100 statements; the schema caps
    // rows at 1000 → at most 50 statements.
    const statements: D1BatchItem[] = []
    for (const chunk of chunkRows(values, 5)) {
      statements.push(
        client
          .insert(examScores)
          .values(chunk)
          .onConflictDoUpdate({
            target: [examScores.examSubjectId, examScores.studentId],
            set: {
              score: sql`excluded.score`,
              grade: sql`excluded.grade`,
              enteredById: sql`excluded.entered_by_id`,
              updatedAt: new Date().toISOString(),
            },
          }),
      )
    }
    await runBatch(client, statements)
  }

  const result = toResult(ref.exam, rows)
  return { ...result, committed: result.summary.valid }
}
