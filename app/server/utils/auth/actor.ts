/**
 * Per-request business-actor resolution (Phase 12 hardening).
 *
 * `AuthContext` (context.ts) carries the user's identity, roles and
 * permission slugs, but NOT the linked business entities (teacherId,
 * studentId, staffProfileId, parent's children). Row-level scoping for
 * teachers/students/parents needs those ids; previously each service
 * re-resolved them ad-hoc (assignments.ts `getActor`, exams.ts
 * `getActor` / `getMySchoolContext`). This module centralises that
 * resolution in one lazily-cached helper so every scoped service shares
 * a single source of truth for "who is the caller as a business entity".
 *
 * It does NOT touch the auth middleware hot path: `loadUserGrants` stays
 * unchanged. Resolution runs only on routes that ask for it, and the
 * DB-resolved ids are cached per request on `event.context.actorBusinessIds`.
 */
import { and, eq, isNull, type SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import {
  parents,
  staffProfiles,
  studentEnrollments,
  studentParents,
  students,
  teacherClassAssignments,
  teachers,
} from '../../../database/schema'
import { getAuthContext, type AuthContext } from './context'
import type { SmsDb } from '../pagination'

/**
 * DB-resolved business ids for the authenticated user. Cached per
 * request; the permission-dependent `isStaff`/`isAdmin` flags live on
 * {@link ActorProfile} so a single cached id-set serves any permission.
 */
export interface ActorBusinessIds {
  userId: string
  teacherId: string | null
  studentId: string | null
  staffProfileId: string | null
  /** Student ids linked to the caller (for parent logins). */
  children: string[]
}

/** Full actor context for a scoped service call. */
export interface ActorProfile extends ActorBusinessIds {
  /** True when the caller holds `staffPermission` OR is an admin. */
  isStaff: boolean
  /** True when the caller has the super_admin or admin role. */
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// Row-level scope classification (Phase 12 hardening).
//
// Pure decision function over {@link ActorProfile}; services map the result
// to WHERE clauses or 403 access checks. Staff (admins and callers holding
// the route's staff permission) bypass row-level scoping and see everything.
// ---------------------------------------------------------------------------

export type ActorScope =
  | { kind: 'staff' } // no row-level constraint
  | { kind: 'teacher'; teacherId: string }
  | { kind: 'student'; studentId: string }
  | { kind: 'parent'; children: string[] }
  | { kind: 'none' } // non-staff with no business ids → no rows

/**
 * Pure decision function: classifies the caller into a row-level scope.
 * Staff see everything; teachers see their own data; students see their
 * own enrollments; parents see their children's data; everyone else sees
 * nothing. Exported for unit testing.
 */
export function classifyActorScope(actor: ActorProfile): ActorScope {
  if (actor.isStaff) return { kind: 'staff' }
  if (actor.teacherId) return { kind: 'teacher', teacherId: actor.teacherId }
  if (actor.studentId) return { kind: 'student', studentId: actor.studentId }
  if (actor.children.length > 0) return { kind: 'parent', children: actor.children }
  return { kind: 'none' }
}

export const EMPTY_BUSINESS_IDS: ActorBusinessIds = {
  userId: '',
  teacherId: null,
  studentId: null,
  staffProfileId: null,
  children: [],
}

/**
 * Resolves the caller's business-entity ids (teacher / student / staff
 * profile / parent's children) from the database, cached per request.
 * Anonymous callers get an empty id-set (authed routes should resolve
 * the auth context first via `requirePermission`).
 */
export async function resolveActorBusinessIds(
  event: H3Event,
): Promise<ActorBusinessIds> {
  const cached = event.context.actorBusinessIds
  if (cached) return cached

  const auth = getAuthContext(event)
  if (!auth) {
    event.context.actorBusinessIds = EMPTY_BUSINESS_IDS
    return EMPTY_BUSINESS_IDS
  }

  const { db } = await import('../db')
  const activeTeacher = isNull(teachers.deletedAt)
  const activeStudent = isNull(students.deletedAt)
  const activeParent = isNull(parents.deletedAt)

  const [teacherRow, studentRow, staffRow, parentRow] = await Promise.all([
    db
      .select({ id: teachers.id })
      .from(teachers)
      .where(and(eq(teachers.userId, auth.user.id), activeTeacher))
      .limit(1),
    db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.userId, auth.user.id), activeStudent))
      .limit(1),
    db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.userId, auth.user.id),
          isNull(staffProfiles.deletedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: parents.id })
      .from(parents)
      .where(and(eq(parents.userId, auth.user.id), activeParent))
      .limit(1),
  ])

  let children: string[] = []
  if (parentRow[0] && !studentRow[0]) {
    const childRows = await db
      .select({ id: students.id })
      .from(studentParents)
      .innerJoin(
        students,
        and(eq(studentParents.studentId, students.id), activeStudent),
      )
      .where(eq(studentParents.parentId, parentRow[0].id))
    children = childRows.map((r) => r.id)
  }

  const ids: ActorBusinessIds = {
    userId: auth.user.id,
    teacherId: teacherRow[0]?.id ?? null,
    studentId: studentRow[0]?.id ?? null,
    staffProfileId: staffRow[0]?.id ?? null,
    children,
  }
  event.context.actorBusinessIds = ids
  return ids
}

/**
 * Resolves the full actor profile for a scoped service call: the cached
 * business ids plus the permission-dependent `isStaff` / `isAdmin` flags.
 * `staffPermission` is the route's staff-permission slug (e.g.
 * `timetable.manage`); a caller holding it (or an admin) is treated as
 * staff and bypasses row-level scoping.
 */
export async function resolveActorProfile(
  event: H3Event,
  staffPermission: string,
): Promise<ActorProfile> {
  const auth: AuthContext | null = getAuthContext(event)
  const ids = await resolveActorBusinessIds(event)
  const roles = auth?.roles ?? []
  const isAdmin = roles.includes('super_admin') || roles.includes('admin')
  const hasStaffPermission = auth?.permissions.includes(staffPermission) ?? false
  return {
    ...ids,
    isAdmin,
    isStaff: hasStaffPermission || isAdmin,
  }
}

// ---------------------------------------------------------------------------
// Actor-accessible class scope (shared by schedule + exams services).
// ---------------------------------------------------------------------------

/** Active enrollment classIds for a student, optionally within one session. */
export async function studentEnrolledClassIds(
  client: SmsDb,
  studentId: string,
  sessionId?: string,
): Promise<string[]> {
  const where: SQL[] = [
    eq(studentEnrollments.studentId, studentId),
    eq(studentEnrollments.status, 'active'),
  ]
  if (sessionId) where.push(eq(studentEnrollments.sessionId, sessionId))
  const rows = await client
    .select({ classId: studentEnrollments.classId })
    .from(studentEnrollments)
    .where(and(...where))
  return [...new Set(rows.map((r) => r.classId))]
}

/** ClassIds a teacher is assigned to teach, optionally within one session. */
export async function teacherTaughtClassIds(
  client: SmsDb,
  teacherId: string,
  sessionId?: string,
): Promise<string[]> {
  const where: SQL[] = [eq(teacherClassAssignments.teacherId, teacherId)]
  if (sessionId) {
    where.push(eq(teacherClassAssignments.sessionId, sessionId))
  }
  const rows = await client
    .select({ classId: teacherClassAssignments.classId })
    .from(teacherClassAssignments)
    .where(and(...where))
  return [...new Set(rows.map((r) => r.classId))]
}
