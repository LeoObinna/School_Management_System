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
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  announcements,
  classes,
  parents,
  sections,
  studentInvoices,
  studentParents,
  students,
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
  ParentFeesSummary,
  ParentSelf,
  ParentSelfProfile,
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
