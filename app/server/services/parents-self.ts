/**
 * Parent self-service queries (README §17, Phase 9).
 *
 * Backs the /parents/me dashboard payload, /parents/me/children and the
 * /parents/me/children/:studentId/{results,attendance} routes. These
 * functions are deliberately scoped to the calling parent (resolved
 * server-side via resolveActorBusinessIds.children); they never accept
 * a parentId from the client. Child-specific routes accept a studentId
 * path param but the service re-verifies it is in the actor's children
 * list before returning any data.
 *
 * Reuses existing services where they already enforce parent scoping:
 *  - {@link listTimetableEntries} already branches on actor.scope and
 *    filters by children's enrolled class ids (not used directly here
 *    — the page links to the shared /timetable view which does this).
 *  - {@link getStudentResults} already enforces parent ownership via
 *    parentOwnsStudent and the publication lock.
 *  - {@link studentAttendance} already enforces parent ownership via
 *    assertStudentAccess.
 *
 * The fees summary is computed directly here from student_invoices for
 * the actor's children (issued/partially_paid statuses) to avoid
 * coupling the dashboard hub to the finance actor resolver.
 */
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  academicSessions,
  announcements,
  classes,
  parents,
  reportCards,
  sections,
  studentInvoices,
  studentParents,
  studentEnrollments,
  students,
  subjects,
  teacherClassAssignments,
  teachers,
  terms,
  users,
} from '../../database/schema'
import { getStudentResults } from './exams'
import { studentAttendance } from './schedule'
import type { ActorProfile } from '../utils/auth/actor'
import { smsForbidden, smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'
import type {
  AnnouncementListItem,
  InvoiceStatus,
  ParentChildSummary,
  ParentChildOverview,
  ParentFeesSummary,
  ParentOverview,
  ParentSelf,
  ParentSelfProfile,
  ParentTeacherContact,
  StudentAttendanceSummary,
  StudentResultSummary,
} from '../../shared/types'
import type { MyChildResultsQuery, StudentAttendanceQuery } from '../../shared/schemas'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const activeParent = isNull(parents.deletedAt)
const activeStudent = isNull(students.deletedAt)

const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [
  'issued',
  'partially_paid',
]

/**
 * True when an invoice is past its due date and still carries a
 * balance. Mirrors finance.ts isInvoiceOverdue so the dashboard number
 * matches the invoices page.
 */
function isOverdue(
  dueDate: string | null,
  balance: number,
  status: InvoiceStatus,
): boolean {
  if (!dueDate || balance <= 0) return false
  if (status === 'draft' || status === 'void' || status === 'paid') {
    return false
  }
  const due = new Date(`${dueDate}T23:59:59`).getTime()
  return Number.isFinite(due) && due < Date.now()
}

/**
 * Asserts the requested studentId belongs to the calling parent. Returns
 * the validated studentId on success; throws 403 otherwise. This is the
 * self-service guard on top of the deeper ownership checks inside
 * getStudentResults / studentAttendance — it catches probing attempts
 * early with a consistent 403.
 */
function assertChildOf(actor: ActorProfile, studentId: string): void {
  if (actor.isStaff) return
  if (!actor.children.includes(studentId)) {
    throw smsForbidden('You can only view your own children.')
  }
}

// ---------------------------------------------------------------------------
// /parents/me — aggregated dashboard payload
// ---------------------------------------------------------------------------

/**
 * Resolves the calling parent's profile or 404s when the caller has no
 * linked parent record (admins/teachers/students hitting /parents/me
 * should see the empty state on the page, not a 500). Parents never see
 * another family's data — the parentId and child list are sourced from
 * the actor.
 */
export async function getParentSelf(actor: ActorProfile): Promise<ParentSelf> {
  if (actor.children.length === 0) {
    // Either no parent profile linked, or a parent with no children yet.
    // Distinguish: if there's no parent profile at all, 404 (empty state).
    const client = await db()
    const [parentRow] = await client
      .select({ id: parents.id })
      .from(parents)
      .where(and(eq(parents.userId, actor.userId), activeParent))
      .limit(1)
    if (!parentRow) {
      throw smsNotFound('No parent profile linked to this account.')
    }
  }
  const client = await db()

  // --- Profile row: parent contact details (read-only).
  const [profileRow] = await client
    .select({
      id: parents.id,
      firstName: parents.firstName,
      lastName: parents.lastName,
      otherNames: parents.otherNames,
      email: parents.email,
      phone: parents.phone,
      gender: parents.gender,
      occupation: parents.occupation,
      address: parents.address,
      photoUrl: parents.photoUrl,
    })
    .from(parents)
    .where(and(eq(parents.userId, actor.userId), activeParent))
    .limit(1)
  if (!profileRow) {
    throw smsNotFound('Parent profile not found.')
  }
  const profile: ParentSelfProfile = profileRow as ParentSelfProfile

  // --- Children with current placement (currentClass/currentSection
  // denormalised names + student_parents relationship).
  const childRows = await client
    .select({
      studentId: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      otherNames: students.otherNames,
      gender: students.gender,
      status: students.status,
      currentClassName: classes.name,
      currentSectionName: sections.name,
      relationship: studentParents.relationship,
      isPrimary: studentParents.isPrimary,
    })
    .from(studentParents)
    .innerJoin(
      students,
      and(eq(studentParents.studentId, students.id), activeStudent),
    )
    .leftJoin(classes, eq(students.currentClassId, classes.id))
    .leftJoin(sections, eq(students.currentSectionId, sections.id))
    .where(eq(studentParents.parentId, profile.id))
    .orderBy(desc(studentParents.isPrimary), students.lastName)
  const children: ParentChildSummary[] = childRows.map(
    (r) => r as ParentChildSummary,
  )

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

  // --- Outstanding fees summary across all children.
  const fees: ParentFeesSummary = await computeFeesSummary(client, actor.children)

  return { profile, children, recentAnnouncements, fees }
}

async function computeFeesSummary(
  client: SmsDb,
  childIds: string[],
): Promise<ParentFeesSummary> {
  if (childIds.length === 0) {
    return { outstandingInvoiceCount: 0, outstandingBalance: 0, overdueInvoiceCount: 0 }
  }
  const rows = await client
    .select({
      balance: studentInvoices.balance,
      dueDate: studentInvoices.dueDate,
      status: studentInvoices.status,
    })
    .from(studentInvoices)
    .where(
      and(
        inArray(studentInvoices.studentId, childIds),
        inArray(studentInvoices.status, OUTSTANDING_INVOICE_STATUSES),
      ),
    )
  let outstandingBalance = 0
  let overdueInvoiceCount = 0
  for (const r of rows) {
    outstandingBalance += r.balance
    if (isOverdue(r.dueDate, r.balance, r.status)) {
      overdueInvoiceCount += 1
    }
  }
  return {
    outstandingInvoiceCount: rows.length,
    outstandingBalance,
    overdueInvoiceCount,
  }
}

// ---------------------------------------------------------------------------
// /parents/me/children — full child roster for the calling parent
// ---------------------------------------------------------------------------

/**
 * Returns the calling parent's children with current placement. This is
 * the same data as getParentSelf().children but exposed as a dedicated
 * endpoint so the page can refresh the roster without pulling the whole
 * dashboard payload.
 */
export async function listMyChildren(
  actor: ActorProfile,
): Promise<{ data: ParentChildSummary[] }> {
  if (actor.children.length === 0) {
    return { data: [] }
  }
  const client = await db()
  const rows = await client
    .select({
      studentId: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      otherNames: students.otherNames,
      gender: students.gender,
      status: students.status,
      currentClassName: classes.name,
      currentSectionName: sections.name,
      relationship: studentParents.relationship,
      isPrimary: studentParents.isPrimary,
    })
    .from(studentParents)
    .innerJoin(
      students,
      and(eq(studentParents.studentId, students.id), activeStudent),
    )
    .leftJoin(classes, eq(students.currentClassId, classes.id))
    .leftJoin(sections, eq(students.currentSectionId, sections.id))
    .where(inArray(studentParents.studentId, actor.children))
    .orderBy(desc(studentParents.isPrimary), students.lastName)
  return { data: rows.map((r) => r as ParentChildSummary) }
}

// ---------------------------------------------------------------------------
// /parents/me/children/:studentId/results — published results for one child
// ---------------------------------------------------------------------------

/**
 * Returns one child's result summary for one session+term. Reuses
 * {@link getStudentResults} which already enforces parent ownership
 * (parentOwnsStudent) and the publication lock. We additionally assert
 * the studentId is in the actor's children so a probing parent gets a
 * 403 instead of relying on the deeper check.
 */
export async function getChildResults(
  studentId: string,
  query: MyChildResultsQuery,
  actor: ActorProfile,
) {
  assertChildOf(actor, studentId)
  return getStudentResults(
    studentId,
    query.sessionId,
    query.termId,
    actor,
  )
}

// ---------------------------------------------------------------------------
// /parents/me/children/:studentId/attendance — attendance for one child
// ---------------------------------------------------------------------------

/**
 * Returns one child's attendance summary + daily records. Reuses
 * {@link studentAttendance} which already enforces parent ownership via
 * assertStudentAccess. We additionally assert the studentId is in the
 * actor's children for an early, consistent 403 on probe attempts.
 */
export async function getChildAttendance(
  studentId: string,
  query: StudentAttendanceQuery,
  actor: ActorProfile,
) {
  assertChildOf(actor, studentId)
  return studentAttendance(studentId, query, actor)
}

// ---------------------------------------------------------------------------
// /parents/me/teachers — deduped teacher contacts (Phase 16B)
// ---------------------------------------------------------------------------

/**
 * The teachers of the calling parent's children, deduped across class
 * and subject assignments for the children's active-enrollment
 * sessions. Powers the message composer: `userId` is the teacher's
 * linked login account (the message recipient); teachers without a
 * user account are listed but can't receive messages. A parent of no
 * children gets an empty list. The child scope comes from the actor —
 * never the client — so a parent can only ever see teachers of their
 * own children's classes.
 */
export async function listMyTeachers(
  actor: ActorProfile,
): Promise<{ data: ParentTeacherContact[] }> {
  if (actor.children.length === 0) {
    return { data: [] }
  }
  const client = await db()

  // Children's active enrollments define the class+session scope.
  const enrollRows = await client
    .select({
      sessionId: studentEnrollments.sessionId,
      classId: studentEnrollments.classId,
    })
    .from(studentEnrollments)
    .where(
      and(
        inArray(studentEnrollments.studentId, actor.children),
        eq(studentEnrollments.status, 'active'),
      ),
    )
  const sessionIds = [...new Set(enrollRows.map((r) => r.sessionId))]
  const classIds = [...new Set(enrollRows.map((r) => r.classId))]
  if (sessionIds.length === 0 || classIds.length === 0) {
    return { data: [] }
  }

  const rows = await client
    .select({
      teacherId: teachers.id,
      userId: teachers.userId,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
      isPrimaryTeacher: teacherClassAssignments.isPrimaryTeacher,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(teacherClassAssignments)
    .innerJoin(
      teachers,
      and(
        eq(teacherClassAssignments.teacherId, teachers.id),
        eq(teachers.isActive, true),
        isNull(teachers.deletedAt),
      ),
    )
    .innerJoin(classes, eq(teacherClassAssignments.classId, classes.id))
    .innerJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
    .where(
      and(
        inArray(teacherClassAssignments.classId, classIds),
        inArray(teacherClassAssignments.sessionId, sessionIds),
      ),
    )
    .orderBy(
      desc(teacherClassAssignments.isPrimaryTeacher),
      asc(classes.name),
      asc(subjects.name),
      asc(teachers.lastName),
    )

  // Dedupe (teacherId, classId, subjectId) — the same teacher can hold
  // overlapping rows across a child's enrollments.
  const seen = new Set<string>()
  const data: ParentTeacherContact[] = []
  for (const r of rows) {
    const key = `${r.teacherId}:${r.className}:${r.subjectName}`
    if (seen.has(key)) continue
    seen.add(key)
    data.push({
      teacherId: r.teacherId,
      userId: r.userId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      className: r.className,
      subjectName: r.subjectName,
      isPrimaryTeacher: r.isPrimaryTeacher,
    })
  }
  return { data }
}

// ---------------------------------------------------------------------------
// /parents/me/overview — per-child portal snapshot (Phase 16B)
// ---------------------------------------------------------------------------

function emptyAttendanceSummary(): StudentAttendanceSummary {
  return {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: null,
  }
}

function computeChildFees(
  rows: Array<{ balance: number; dueDate: string | null; status: InvoiceStatus }>,
): ParentFeesSummary {
  let outstandingBalance = 0
  let overdueInvoiceCount = 0
  for (const r of rows) {
    outstandingBalance += r.balance
    if (isOverdue(r.dueDate, r.balance, r.status)) {
      overdueInvoiceCount += 1
    }
  }
  return {
    outstandingInvoiceCount: rows.length,
    outstandingBalance,
    overdueInvoiceCount,
  }
}

/**
 * Per-child dashboard snapshot: current-term progress (via
 * {@link getStudentResults} — the publication lock applies, so
 * unpublished terms show null), cumulative average across published
 * report cards, current-term attendance summary and per-child
 * outstanding fees. Children are resolved from the actor; a probing
 * parent can never widen the list. A child failing one sub-query
 * (e.g. not actively enrolled this session) yields null/empty for that
 * slice instead of failing the whole overview.
 */
export async function getParentOverview(
  actor: ActorProfile,
): Promise<ParentOverview> {
  if (actor.children.length === 0) {
    return { session: null, term: null, children: [] }
  }
  const client = await db()

  const [session] = await client
    .select({ id: academicSessions.id, name: academicSessions.name })
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1)
  const [term] = await client
    .select({ id: terms.id, name: terms.name })
    .from(terms)
    .where(eq(terms.isCurrent, true))
    .limit(1)

  const children: ParentChildOverview[] = []
  for (const childId of actor.children) {
    const [child] = await client
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        className: classes.name,
      })
      .from(students)
      .leftJoin(classes, eq(students.currentClassId, classes.id))
      .where(and(eq(students.id, childId), activeStudent))
      .limit(1)
    if (!child) continue

    // --- Current-term progress (published results only).
    let progress: StudentResultSummary | null = null
    if (session && term) {
      try {
        progress = await getStudentResults(childId, session.id, term.id, actor)
      } catch {
        // Not actively enrolled this session — no progress slice.
        progress = null
      }
    }

    // --- Cumulative average across published report cards (×100 ints).
    const rcRows = await client
      .select({ averageScore: reportCards.averageScore })
      .from(reportCards)
      .where(
        and(
          eq(reportCards.studentId, childId),
          eq(reportCards.status, 'published'),
        ),
      )
    const rcSum = rcRows.reduce((acc, r) => acc + (r.averageScore ?? 0), 0)
    const cumulativeAverage =
      rcRows.length > 0 ? (rcSum / rcRows.length / 100).toFixed(2) : null

    // --- Attendance for the current session/term.
    let attendance = emptyAttendanceSummary()
    if (session) {
      try {
        const query = {
          sessionId: session.id,
          ...(term ? { termId: term.id } : {}),
        }
        attendance = (await studentAttendance(childId, query, actor)).summary
      } catch {
        attendance = emptyAttendanceSummary()
      }
    }

    // --- Per-child outstanding fees.
    const invoiceRows = await client
      .select({
        balance: studentInvoices.balance,
        dueDate: studentInvoices.dueDate,
        status: studentInvoices.status,
      })
      .from(studentInvoices)
      .where(
        and(
          eq(studentInvoices.studentId, childId),
          inArray(studentInvoices.status, OUTSTANDING_INVOICE_STATUSES),
        ),
      )

    children.push({
      studentId: child.id,
      name: `${child.firstName} ${child.lastName}`.trim(),
      admissionNumber: child.admissionNumber,
      className: child.className,
      progress,
      cumulativeAverage,
      attendance,
      fees: computeChildFees(invoiceRows),
    })
  }

  return {
    session: session ?? null,
    term: term ?? null,
    children,
  }
}
