/**
 * Student self-service queries (README §17, Phase 8).
 *
 * Backs the /students/me dashboard payload, /students/me/timetable and
 * /students/me/results routes. These functions are deliberately scoped
 * to the calling student (resolved server-side via
 * {@link resolveActorBusinessIds}); they never accept a studentId from
 * the client. The student's class list comes from the canonical
 * {@link studentEnrolledClassIds} resolver so we stay consistent with
 * the timetable/exams/attendance scopes.
 *
 * Reuses existing services where they already enforce student scoping:
 *  - {@link listTimetableEntries} already branches on actor.scope and
 *    filters by the student's enrolled class ids.
 *  - {@link listMyAssignments} already filters by the student's active
 *    enrollments and joins the student's own submission row.
 *  - {@link getStudentResults} already enforces the publication lock
 *    (students see nothing until the result_publications row is
 *    'published') and the self/parent/staff access rule.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import {
  academicSessions,
  announcements,
  classes,
  examScores,
  examSubjects,
  exams,
  parents,
  resultPublications,
  sections,
  studentEnrollments,
  studentParents,
  students,
  subjects,
  terms,
  users,
} from '../../database/schema'
import { listMyAssignments } from './assignments'
import { getStudentResults } from './exams'
import { listEnrollments } from './people'
import { listTimetableEntries, studentAttendance } from './schedule'
import type { ActorProfile } from '../utils/auth/actor'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'
import type {
  AnnouncementListItem,
  StudentActiveEnrollment,
  StudentAttendanceDay,
  StudentAttendanceSummary,
  StudentDashboard,
  StudentEnrollmentDetail,
  StudentRecentScore,
  StudentSelf,
  StudentSelfProfile,
} from '../../shared/types'
import type { MyTimetableQuery } from '../../shared/schemas'
import { WEEKDAYS } from '../../shared/schemas/schedule'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const activeStudent = isNull(students.deletedAt)
const activeParent = isNull(parents.deletedAt)

function todayWeekday(): typeof WEEKDAYS[number] {
  // Server runs in UTC; the school's local day is Asia/Lagos per the
  // seed data. UTC noon matches local day across DST transitions.
  const now = new Date()
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  const days = WEEKDAYS
  return days[lagos.getUTCDay()] as typeof WEEKDAYS[number]
}

// ---------------------------------------------------------------------------
// /students/me — aggregated dashboard payload
// ---------------------------------------------------------------------------

/**
 * Resolves the calling student's profile or 404s when the caller has no
 * linked student record (admins/teachers/parents hitting /students/me
 * should see the empty state on the page, not a 500). Students never see
 * another student's data — the studentId is sourced from the actor.
 */
export async function getStudentSelf(
  actor: ActorProfile,
): Promise<StudentSelf> {
  if (!actor.studentId) {
    throw smsNotFound('No student profile linked to this account.')
  }
  const client = await db()

  // --- Profile row: student + current placement names + primary guardian
  // (read-only). The currentClass/currentSection columns are convenience
  // denormalisations per README §13; historical enrollment must still be
  // read from student_enrollments (handled below as activeEnrollment).
  const [profileRow] = await client
    .select({
      id: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      otherNames: students.otherNames,
      gender: students.gender,
      dateOfBirth: students.dateOfBirth,
      status: students.status,
      photoUrl: students.photoUrl,
      currentClassName: classes.name,
      currentSectionName: sections.name,
      guardianFirstName: parents.firstName,
      guardianLastName: parents.lastName,
      guardianEmail: parents.email,
      guardianPhone: parents.phone,
    })
    .from(students)
    .leftJoin(classes, eq(students.currentClassId, classes.id))
    .leftJoin(sections, eq(students.currentSectionId, sections.id))
    .leftJoin(
      studentParents,
      and(
        eq(studentParents.studentId, students.id),
        eq(studentParents.isPrimary, true),
      ),
    )
    .leftJoin(
      parents,
      and(
        eq(studentParents.parentId, parents.id),
        activeParent,
      ),
    )
    .where(and(eq(students.id, actor.studentId), activeStudent))
    .limit(1)
  if (!profileRow) {
    throw smsNotFound('Student profile not found.')
  }
  const profile: StudentSelfProfile = profileRow as StudentSelfProfile

  // --- Active enrollment in the current session. Try the session marked
  // isCurrent; if none, fall back to the most recent active enrollment so
  // the dashboard still shows placement between sessions.
  const [currentSession] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1)

  const enrollmentWhere = currentSession
    ? and(
        eq(studentEnrollments.studentId, actor.studentId),
        eq(studentEnrollments.status, 'active'),
        eq(studentEnrollments.sessionId, currentSession.id),
      )
    : and(
        eq(studentEnrollments.studentId, actor.studentId),
        eq(studentEnrollments.status, 'active'),
      )

  const enrollmentRows = await client
    .select({
      classId: studentEnrollments.classId,
      className: classes.name,
      sectionId: studentEnrollments.sectionId,
      sectionName: sections.name,
      sessionId: studentEnrollments.sessionId,
      sessionName: academicSessions.name,
      termId: studentEnrollments.termId,
      termName: terms.name,
      rollNumber: studentEnrollments.rollNumber,
      enrollmentDate: studentEnrollments.enrollmentDate,
    })
    .from(studentEnrollments)
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(sections, eq(studentEnrollments.sectionId, sections.id))
    .innerJoin(
      academicSessions,
      eq(studentEnrollments.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(studentEnrollments.termId, terms.id))
    .where(enrollmentWhere)
    .orderBy(desc(studentEnrollments.enrollmentDate))
    .limit(1)
  const activeEnrollment: StudentActiveEnrollment | null = enrollmentRows[0]
    ? (enrollmentRows[0] as StudentActiveEnrollment)
    : null

  // --- Today's timetable (top 10 by start time). listTimetableEntries
  // already filters by the student's active enrollment class ids.
  const timetableResponse = await listTimetableEntries(
    {
      weekday: todayWeekday(),
      page: 1,
      perPage: 10,
      order: 'asc',
    },
    actor,
  )

  // --- Pending assignments: published work the student hasn't submitted
  // yet (no submission row) or where their submission is still in 'draft'.
  // listMyAssignments already restricts to assignments for the student's
  // active enrollments and joins the student's own submission row.
  const myAssignmentsResponse = await listMyAssignments({}, actor)
  const pendingAssignments = myAssignmentsResponse.data
    .filter(
      (a) => !a.mySubmission || a.mySubmission.status === 'draft',
    )
    .slice(0, 5)

  // --- 5 most recent published announcements school-wide.
  const announcementRows = await client
    .select({
      announcement: announcements,
      authorName: users.name,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.status, 'published'))
    .orderBy(desc(announcements.createdAt))
    .limit(5)
  const recentAnnouncements = announcementRows.map((r) => ({
    ...toJsonModel<AnnouncementListItem>(r.announcement),
    authorName: r.authorName ?? null,
  }))

  return {
    profile,
    activeEnrollment,
    todayTimetable: timetableResponse.data,
    pendingAssignments,
    recentAnnouncements,
  }
}

// ---------------------------------------------------------------------------
// /students/me/timetable — full weekly view for the calling student
// ---------------------------------------------------------------------------

/**
 * Returns the calling student's timetable entries (optionally narrowed
 * to one weekday and/or one session). Reuses {@link listTimetableEntries}
 * which already enforces row-level scoping via {@link classifyActorScope}
 * — a student sees only entries for classes they are actively enrolled
 * in. Defaults to a 100-row page so the weekly view fits in one call.
 */
export async function listMyTimetable(
  query: MyTimetableQuery,
  actor: ActorProfile,
) {
  if (!actor.studentId) {
    throw smsNotFound('No student profile linked to this account.')
  }
  const response = await listTimetableEntries(
    {
      sessionId: query.sessionId,
      weekday: query.weekday,
      page: 1,
      perPage: 100,
      order: 'asc',
    },
    actor,
  )
  return { data: response.data, total: response.total }
}

// ---------------------------------------------------------------------------
// /students/me/results — published results for the calling student
// ---------------------------------------------------------------------------

/**
 * Returns the calling student's result summary for one session+term.
 * Reuses {@link getStudentResults} which already enforces:
 *   - actor.studentId must match (or actor is parent/staff),
 *   - the result_publications row must be in 'published' status before
 *     any subject scores are returned to a student,
 *   - active enrollment in the session must exist.
 *
 * The route requires both sessionId and termId so we never silently
 * return an empty "current term" result for a term that hasn't been
 * published yet.
 */
export async function getMyResults(
  query: { sessionId: string; termId: string },
  actor: ActorProfile,
) {
  if (!actor.studentId) {
    throw smsNotFound('No student profile linked to this account.')
  }
  // getStudentResults expects the local Actor interface; ActorProfile is
  // structurally compatible (userId/isStaff/isAdmin/teacherId/studentId).
  return getStudentResults(
    actor.studentId,
    query.sessionId,
    query.termId,
    actor,
  )
}

// ---------------------------------------------------------------------------
// /students/me/dashboard — Phase 16A student-portal landing payload
// ---------------------------------------------------------------------------

/** Formats an INTEGER ×100 score as a decimal string (e.g. 8550 → "85.50"). */
function formatScoreFixed(value: number): string {
  return (value / 100).toFixed(2)
}

/**
 * The student's most recent exam scores that are safe to show: each row
 * only surfaces once the result_publications row for the exam's
 * session/term/class is 'published' — the same lock
 * {@link getStudentResults} enforces for the full result sheet. The
 * student_enrollments join pins the publication section to the
 * student's own section and guarantees the exam belongs to a class the
 * student was actively enrolled in. NULL-safe term/section matching
 * uses SQLite IS NOT DISTINCT FROM so publications without a section
 * still match.
 */
async function listRecentScores(
  client: SmsDb,
  studentId: string,
): Promise<StudentRecentScore[]> {
  const rows = await client
    .select({
      examId: exams.id,
      examName: exams.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      score: examScores.score,
      maxScore: examSubjects.maxScore,
      grade: examScores.grade,
      enteredAt: examScores.updatedAt,
    })
    .from(examScores)
    .innerJoin(examSubjects, eq(examScores.examSubjectId, examSubjects.id))
    .innerJoin(exams, eq(examSubjects.examId, exams.id))
    .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
    .innerJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.studentId, examScores.studentId),
        eq(studentEnrollments.sessionId, exams.sessionId),
        eq(studentEnrollments.classId, exams.classId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .innerJoin(
      resultPublications,
      and(
        eq(resultPublications.sessionId, exams.sessionId),
        eq(resultPublications.classId, exams.classId),
        eq(resultPublications.status, 'published'),
        sql`(${resultPublications.termId} IS NOT DISTINCT FROM ${exams.termId})`,
        sql`(${resultPublications.sectionId} IS NOT DISTINCT FROM ${studentEnrollments.sectionId})`,
      ),
    )
    .where(eq(examScores.studentId, studentId))
    .orderBy(desc(examScores.updatedAt))
    .limit(10)
  return rows.map((row) => ({
    ...row,
    score: formatScoreFixed(row.score),
    maxScore: formatScoreFixed(row.maxScore),
  }))
}

/**
 * Aggregated student-portal dashboard (Phase 16A): everything
 * {@link getStudentSelf} returns plus the full-week timetable, recent
 * published scores and the current-term attendance summary. Scoping is
 * identical to /students/me — the studentId comes from the actor, never
 * the client, and every delegated helper re-checks row-level access.
 */
export async function getStudentDashboard(
  actor: ActorProfile,
): Promise<StudentDashboard> {
  const base = await getStudentSelf(actor)

  // --- Full-week timetable (same scoped resolver as today's view).
  const weekTimetableResponse = await listTimetableEntries(
    { page: 1, perPage: 100, order: 'asc' },
    actor,
  )

  // --- Recent published exam scores.
  const client = await db()
  const recentScores = actor.studentId
    ? await listRecentScores(client, actor.studentId)
    : []

  // --- Attendance for the enrollment's session (term where known).
  // studentAttendance re-checks row-level access for the caller.
  let attendanceSummary: StudentAttendanceSummary = {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: null,
  }
  let recentAttendanceDays: StudentAttendanceDay[] = []
  if (base.activeEnrollment) {
    const query = {
      sessionId: base.activeEnrollment.sessionId,
      ...(base.activeEnrollment.termId
        ? { termId: base.activeEnrollment.termId }
        : {}),
    }
    const attendance = await studentAttendance(
      base.profile.id,
      query,
      actor,
    )
    attendanceSummary = attendance.summary
    recentAttendanceDays = attendance.data.slice(0, 5)
  }

  return {
    ...base,
    weekTimetable: weekTimetableResponse.data,
    recentScores,
    attendanceSummary,
    recentAttendanceDays,
  }
}

// ---------------------------------------------------------------------------
// /students/me/enrollments — view-only enrollment history (Phase 16A)
// ---------------------------------------------------------------------------

/**
 * The calling student's enrollment history (all sessions, newest
 * first). View-only: registration stays with staff (Phase 16 owner
 * decision #2). Reuses {@link listEnrollments} filtered by the
 * server-resolved studentId — never a client-supplied one.
 */
export async function listMyEnrollments(
  actor: ActorProfile,
): Promise<{ data: StudentEnrollmentDetail[]; total: number }> {
  if (!actor.studentId) {
    throw smsNotFound('No student profile linked to this account.')
  }
  // page/perPage/order are required by the shared query type but the
  // underlying listEnrollments returns the full history unpaginated.
  return listEnrollments({
    studentId: actor.studentId,
    page: 1,
    perPage: 200,
    order: 'asc',
  })
}
