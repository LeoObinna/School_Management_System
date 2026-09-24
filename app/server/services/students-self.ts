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
import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  academicSessions,
  announcements,
  classes,
  parents,
  sections,
  studentEnrollments,
  studentParents,
  students,
  terms,
  users,
} from '../../database/schema'
import { listMyAssignments } from './assignments'
import { getStudentResults } from './exams'
import { listTimetableEntries } from './schedule'
import type { ActorProfile } from '../utils/auth/actor'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'
import type {
  AnnouncementListItem,
  StudentActiveEnrollment,
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
