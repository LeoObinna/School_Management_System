/**
 * Teacher self-service queries (README §17, Phase 7).
 *
 * Backs the /teachers/me dashboard payload, /teacher-assignments/me,
 * /teachers/me/students and /teachers/me/to-grade routes. These
 * functions are deliberately scoped to the calling teacher (resolved
 * server-side via {@link resolveActorBusinessIds}); they never accept a
 * teacherId from the client. The shared {@link teacherTaughtClassIds}
 * resolver is the canonical source of "which classes does this teacher
 * teach" so we stay consistent with the timetable/exam-results scopes.
 */
import { and, asc, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import {
  announcements,
  assignmentSubmissions,
  assignments,
  classes,
  parents,
  sections,
  studentEnrollments,
  studentParents,
  students,
  subjects,
  teachers,
  users,
} from '../../database/schema'
import {
  listAssignments as listTeacherClassAssignments,
} from './teacher-academics'
import { listTimetableEntries } from './schedule'
import type { ActorProfile } from '../utils/auth/actor'
import { teacherTaughtClassIds } from '../utils/auth/actor'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'
import type {
  AnnouncementListItem,
  TeacherAssignmentToGradeRow,
  TeacherClassAssignmentDetail,
  TeacherSelf,
  TeacherStudentRow,
} from '../../shared/types'
import type {
  MyStudentListQuery,
  SubmissionsToGradeQuery,
} from '../../shared/schemas'
import { WEEKDAYS } from '../../shared/schemas/schedule'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const activeStudent = isNull(students.deletedAt)
const activeTeacher = isNull(teachers.deletedAt)
const activeParent = isNull(parents.deletedAt)

function todayWeekday(): typeof WEEKDAYS[number] {
  // server runs in UTC; the school's local day is Asia/Lagos per the
  // seed data. UTC noon matches local day across DST transitions.
  const now = new Date()
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  const days = WEEKDAYS
  return days[lagos.getUTCDay()] as typeof WEEKDAYS[number]
}

// ---------------------------------------------------------------------------
// /teachers/me — aggregated dashboard payload
// ---------------------------------------------------------------------------

/**
 * Resolves the calling teacher's profile or 404s when the caller has no
 * linked teacher record (admins/students/parents hitting /teachers/me
 * should see the empty state on the page, not a 500, so the route still
 * returns 404 and the page can render accordingly).
 */
export async function getTeacherSelf(
  actor: ActorProfile,
): Promise<TeacherSelf> {
  if (!actor.teacherId) {
    throw smsNotFound('No teacher profile linked to this account.')
  }
  const client = await db()
  const [profileRow] = await client
    .select({
      id: teachers.id,
      staffNumber: teachers.staffNumber,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
      email: teachers.email,
      phone: teachers.phone,
      specialization: teachers.specialization,
      qualification: teachers.qualification,
    })
    .from(teachers)
    .where(and(eq(teachers.id, actor.teacherId), activeTeacher))
    .limit(1)
  if (!profileRow) {
    throw smsNotFound('Teacher profile not found.')
  }

  // Assigned classes (TeacherClassAssignmentDetail shape) — reuse the
  // teacher-academics service so the /teachers/me page renders the same
  // rows the admin /academics/assignments page shows for one teacher.
  const classes = await listTeacherClassAssignments({
    teacherId: actor.teacherId,
  })

  // Today's timetable (top 10 by start time) — reuse the schedule
  // service so we keep the same row-level scoping pattern (teacher
  // branch in listTimetableEntries already filters by teacherId).
  const timetableResponse = await listTimetableEntries(
    {
      weekday: todayWeekday(),
      page: 1,
      perPage: 10,
      order: 'asc',
    },
    actor,
  )

  // Pending submissions-to-grade count — only assignments this teacher
  // owns with submissions in submitted/late status.
  const pendingRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(assignmentSubmissions)
    .innerJoin(
      assignments,
      eq(assignmentSubmissions.assignmentId, assignments.id),
    )
    .where(
      and(
        eq(assignments.teacherId, actor.teacherId),
        sql`${assignmentSubmissions.status} in ('submitted', 'late')`,
      ),
    )
  const pendingSubmissionsCount = Number(pendingRows[0]?.n ?? 0)

  // 5 most recent published announcements school-wide.
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
    profile: profileRow,
    classes,
    todayTimetable: timetableResponse.data,
    pendingSubmissionsCount,
    recentAnnouncements,
  }
}

// ---------------------------------------------------------------------------
// /teacher-assignments/me — self-service variant of the admin endpoint
// ---------------------------------------------------------------------------

/**
 * Returns the calling teacher's class assignments using the same shape
 * as the admin {@link listTeacherClassAssignments}. Reuses that helper
 * rather than re-implementing the joins so future display columns stay
 * in sync.
 */
export async function listMyClasses(
  actor: ActorProfile,
  filters: { sessionId?: string } = {},
): Promise<{ data: TeacherClassAssignmentDetail[] }> {
  if (!actor.teacherId) {
    throw smsNotFound('No teacher profile linked to this account.')
  }
  const data = await listTeacherClassAssignments({
    teacherId: actor.teacherId,
    sessionId: filters.sessionId,
  })
  return { data }
}

// ---------------------------------------------------------------------------
// /teachers/me/students — roster across assigned classes
// ---------------------------------------------------------------------------

function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, '\\$&')}%`
}

/**
 * Returns the active students enrolled in the calling teacher's
 * assigned classes (optionally filtered by one classId). Joins the
 * primary guardian so the teacher can reach families without opening
 * each student detail. A classId the teacher does not teach narrows
 * the result to an empty page (never an error, never other classes)
 * so the endpoint cannot be probed for class existence.
 */
export async function listMyStudents(
  query: MyStudentListQuery,
  actor: ActorProfile,
) {
  if (!actor.teacherId) {
    throw smsNotFound('No teacher profile linked to this account.')
  }
  const client = await db()
  const classIds = await teacherTaughtClassIds(client, actor.teacherId)

  const emptyPage = {
    data: [] as TeacherStudentRow[],
    total: 0,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total: 0,
      lastPage: 1,
    },
  }
  if (classIds.length === 0) {
    return emptyPage
  }

  // Allow narrowing to one of the teacher's classes. A classId the
  // teacher does not teach (or a stale/deleted one) narrows to an empty
  // page rather than falling back to all rows — an explicit filter must
  // never silently widen — and we never reveal whether it exists.
  if (query.classId && !classIds.includes(query.classId)) {
    return emptyPage
  }
  const scopeClassIds = query.classId ? [query.classId] : classIds

  const where: SQL[] = [
    activeStudent,
    eq(studentEnrollments.status, 'active'),
    inArray(studentEnrollments.classId, scopeClassIds),
  ]
  if (query.search) {
    const pattern = likePattern(query.search)
    const expr = or(
      like(students.firstName, pattern),
      like(students.lastName, pattern),
      like(students.admissionNumber, pattern),
    )
    if (expr) {
      where.push(expr)
    }
  }

  // One row per enrollment, joined to the student + their class +
  // section + primary guardian (left join via student_parents.is_primary).
  const rows = await client
    .select({
      id: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      status: students.status,
      className: classes.name,
      sectionName: sections.name,
      guardianFirstName: parents.firstName,
      guardianLastName: parents.lastName,
      guardianEmail: parents.email,
      guardianPhone: parents.phone,
    })
    .from(studentEnrollments)
    .innerJoin(
      students,
      and(eq(studentEnrollments.studentId, students.id), activeStudent),
    )
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(sections, eq(studentEnrollments.sectionId, sections.id))
    .leftJoin(
      studentParents,
      and(
        eq(studentParents.studentId, students.id),
        eq(studentParents.isPrimary, true),
      ),
    )
    .leftJoin(
      parents,
      and(eq(studentParents.parentId, parents.id), activeParent),
    )
    .where(and(...where))
    .orderBy(asc(students.admissionNumber))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const countRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(studentEnrollments)
    .innerJoin(
      students,
      and(eq(studentEnrollments.studentId, students.id), activeStudent),
    )
    .where(and(...where))
  const total = Number(countRows[0]?.n ?? 0)

  const data: TeacherStudentRow[] = rows.map((r) => ({
    id: r.id,
    admissionNumber: r.admissionNumber,
    firstName: r.firstName,
    lastName: r.lastName,
    status: r.status,
    className: r.className,
    sectionName: r.sectionName,
    guardianName:
      [r.guardianFirstName, r.guardianLastName].filter(Boolean).join(' ').trim()
      || null,
    guardianPhone: r.guardianPhone,
    guardianEmail: r.guardianEmail,
  }))

  return {
    data,
    total,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

// ---------------------------------------------------------------------------
// /teachers/me/to-grade — assignments with pending submissions
// ---------------------------------------------------------------------------

/**
 * Returns one row per assignment owned by the calling teacher that has
 * at least one submission still awaiting review (submitted or late).
 * The pendingCount is the number of submissions in that status — the
 * teacher grades them one at a time on the existing /assignments/[id]
 * grading view, so this endpoint is just a queue pointer.
 */
export async function listSubmissionsToGrade(
  query: SubmissionsToGradeQuery,
  actor: ActorProfile,
): Promise<{ data: TeacherAssignmentToGradeRow[] }> {
  if (!actor.teacherId) {
    throw smsNotFound('No teacher profile linked to this account.')
  }
  const client = await db()

  const statuses = query.status ? [query.status] : ['submitted', 'late']
  const statusesCsv = statuses.map((s) => `'${s}'`).join(', ')
  const where: SQL[] = [
    eq(assignments.teacherId, actor.teacherId),
    sql`${assignmentSubmissions.status} in (${sql.raw(statusesCsv)})`,
  ]
  if (query.classId) {
    where.push(eq(assignments.classId, query.classId))
  }
  if (query.subjectId) {
    where.push(eq(assignments.subjectId, query.subjectId))
  }

  const rows = await client
    .select({
      assignmentId: assignments.id,
      title: assignments.title,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
      dueDate: assignments.dueDate,
      pendingCount: sql<number>`cast(count(${assignmentSubmissions.id}) as integer)`,
    })
    .from(assignments)
    .innerJoin(classes, eq(assignments.classId, classes.id))
    .leftJoin(sections, eq(assignments.sectionId, sections.id))
    .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
    .innerJoin(
      assignmentSubmissions,
      eq(assignmentSubmissions.assignmentId, assignments.id),
    )
    .where(and(...where))
    .groupBy(
      assignments.id,
      classes.name,
      sections.name,
      subjects.name,
      assignments.dueDate,
    )
    .orderBy(desc(assignments.dueDate))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return {
    data: rows.map((r) => ({
      assignmentId: r.assignmentId,
      title: r.title,
      className: r.className,
      sectionName: r.sectionName,
      subjectName: r.subjectName,
      dueDate: r.dueDate,
      pendingCount: Number(r.pendingCount),
    })),
  }
}
