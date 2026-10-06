/**
 * Public result checker service (Phase 18D).
 *
 * Anonymous access is gated by identity factors the enquirer already
 * holds: the student's admission number plus exact surname and the
 * session/term the result belongs to. Results are only answered when
 * the `result_publications` row for the student's class/section is
 * `published` — the same publication lock as the authenticated
 * getStudentResults view. Score aggregation reuses that core
 * (aggregateStudentResults).
 *
 * Enumeration defence: every failure — unknown admission number,
 * surname mismatch, missing/ended enrollment, non-published
 * publication — is the same generic 404. The route additionally
 * applies the `public-result-check` IP rate limit.
 */
import { and, eq, isNull } from 'drizzle-orm'
import {
  academicSessions,
  classes,
  resultPublications,
  studentEnrollments,
  students,
  terms,
} from '../../database/schema'
import {
  publicResultSchema,
  type PublicResult,
  type PublicResultQuery,
} from '../../shared/schemas'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import {
  aggregateStudentResults,
  computeGrade,
  getActiveGradingScaleItems,
} from './exams'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

function genericNotFound(): never {
  throw smsNotFound('No published results match those details.')
}

export async function getPublicResult(
  query: PublicResultQuery,
): Promise<PublicResult> {
  const client = await db()

  // 1. Student by admission number (unique index); non-deleted only.
  const [student] = await client
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    })
    .from(students)
    .where(
      and(
        eq(students.admissionNumber, query.admissionNumber),
        isNull(students.deletedAt),
      ),
    )
    .limit(1)

  // Surname gate (case-insensitive, exact). Same generic error as an
  // unknown admission number.
  if (
    !student ||
    student.lastName.toLowerCase() !== query.surname.toLowerCase()
  ) {
    genericNotFound()
  }

  // 2. Session must exist.
  const [session] = await client
    .select({ name: academicSessions.name })
    .from(academicSessions)
    .where(eq(academicSessions.id, query.sessionId))
    .limit(1)
  if (!session) genericNotFound()

  // 3. Term must exist AND belong to that session.
  const [term] = await client
    .select({ name: terms.name })
    .from(terms)
    .where(
      and(
        eq(terms.id, query.termId),
        eq(terms.sessionId, query.sessionId),
      ),
    )
    .limit(1)
  if (!term) genericNotFound()

  // 4. Active enrollment in that session (historical record; termId on
  // the enrollment row may be null, so it is intentionally not
  // filtered here — same as the authenticated result view).
  const [enrollment] = await client
    .select({
      classId: studentEnrollments.classId,
      sectionId: studentEnrollments.sectionId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.studentId, student.id),
        eq(studentEnrollments.sessionId, query.sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .limit(1)
  if (!enrollment) genericNotFound()

  // 5. Publication lock: session/term/class/section must be published.
  const pubConditions = [
    eq(resultPublications.sessionId, query.sessionId),
    eq(resultPublications.termId, query.termId),
    eq(resultPublications.classId, enrollment.classId),
    enrollment.sectionId
      ? eq(resultPublications.sectionId, enrollment.sectionId)
      : isNull(resultPublications.sectionId),
  ]
  const [pub] = await client
    .select({ status: resultPublications.status })
    .from(resultPublications)
    .where(and(...pubConditions))
    .limit(1)
  if (pub?.status !== 'published') genericNotFound()

  // 6. Class name.
  const [klass] = await client
    .select({ name: classes.name })
    .from(classes)
    .where(eq(classes.id, enrollment.classId))
    .limit(1)

  // 7. Published score aggregation (same core as the staff views).
  const agg = await aggregateStudentResults(
    client,
    student.id,
    query.sessionId,
    query.termId,
  )
  const scaleItems = await getActiveGradingScaleItems(client, query.sessionId)
  const overallPct =
    agg.maxScore > 0 ? (agg.totalScore / agg.maxScore) * 100 : 0

  return publicResultSchema.parse({
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    sessionName: session.name,
    termName: term.name,
    className: klass?.name ?? '',
    subjects: agg.subjects.map((s) => ({
      subjectName: s.subjectName,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      percentage: s.percentage,
      grade: s.grade,
    })),
    totalScore: (agg.totalScore / 100).toFixed(2),
    averageScore: overallPct.toFixed(2),
    overallGrade: computeGrade(overallPct, scaleItems),
  }) as PublicResult
}
