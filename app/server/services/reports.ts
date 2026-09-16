/**
 * Reports/audit domain service (README §26/§27, Phase 11).
 *
 * Operational aggregates (overview counts, attendance-by-class,
 * enrollments-by-class-status) and the audit log list with manual
 * pagination + LEFT JOIN to users for actor name/email.
 *
 * These are read-only aggregates; nothing here mutates state. CSV
 * rendering lives at the route layer (mirrors finance/outstanding.get.ts).
 */
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import {
  announcements,
  auditLogs,
  attendanceRecords,
  attendanceSessions,
  classes,
  events,
  parents,
  sections,
  staffProfiles,
  studentEnrollments,
  students,
  subjects,
  teachers,
  users,
} from '../../database/schema'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'
import type {
  AttendanceReportClassRow,
  AuditLog,
  AuditLogListItem,
  EnrollmentReportRow,
  OverviewReport,
} from '../../shared/types'
import type {
  AttendanceOverviewReportQuery,
  AuditLogListQuery,
  EnrollmentReportQuery,
  OverviewQuery,
} from '../../shared/schemas'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// drizzle's and() is typed as SQL | undefined; collapse to SQL.
function all(conditions: Array<SQL | undefined>): SQL {
  return and(...conditions) ?? sql`true`
}

const ENROLLMENT_STATUSES = [
  'active',
  'completed',
  'promoted',
  'repeated',
  'withdrawn',
] as const
const ANNOUNCEMENT_STATUSES = [
  'draft',
  'scheduled',
  'published',
  'archived',
] as const
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export async function getOverview(
  query: OverviewQuery,
): Promise<OverviewReport> {
  const client = await db()

  const [studentCounts] = await client
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${students.status} = 'active')::int`,
      archived: sql<number>`count(*) filter (where ${students.status} = 'archived')::int`,
    })
    .from(students)
    .where(isNull(students.deletedAt))

  const [teacherCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(teachers)
    .where(isNull(teachers.deletedAt))
  const [parentCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(parents)
    .where(isNull(parents.deletedAt))
  const [staffCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(staffProfiles)
    .where(isNull(staffProfiles.deletedAt))
  const [classCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(classes)
    .where(eq(classes.isActive, true))
  const [sectionCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(sections)
    .where(eq(sections.isActive, true))
  const [subjectCount] = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(subjects)
    .where(eq(subjects.isActive, true))

  const enrollmentWhere: SQL[] = []
  if (query.sessionId) {
    enrollmentWhere.push(eq(studentEnrollments.sessionId, query.sessionId))
  }
  const enrollmentStatusRows = await client
    .select({
      status: studentEnrollments.status,
      n: sql<number>`count(*)::int`,
    })
    .from(studentEnrollments)
    .where(all(enrollmentWhere))
    .groupBy(studentEnrollments.status)
  const enrollmentsByStatus = {
    active: 0,
    completed: 0,
    promoted: 0,
    repeated: 0,
    withdrawn: 0,
  } as OverviewReport['enrollmentsByStatus']
  for (const r of enrollmentStatusRows) {
    enrollmentsByStatus[r.status] = r.n
  }

  const announcementStatusRows = await client
    .select({
      status: announcements.status,
      n: sql<number>`count(*)::int`,
    })
    .from(announcements)
    .groupBy(announcements.status)
  const announcementsByStatus = {
    draft: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  } as OverviewReport['announcementsByStatus']
  for (const r of announcementStatusRows) {
    announcementsByStatus[r.status] = r.n
  }

  const [eventCounts] = await client
    .select({
      upcoming: sql<number>`count(*) filter (where ${events.startsAt} > now() and ${events.status} = 'published')::int`,
      past: sql<number>`count(*) filter (where ${events.startsAt} <= now() and ${events.status} = 'published')::int`,
    })
    .from(events)

  return {
    studentsTotal: studentCounts?.total ?? 0,
    studentsActive: studentCounts?.active ?? 0,
    studentsArchived: studentCounts?.archived ?? 0,
    teachers: teacherCount?.n ?? 0,
    parents: parentCount?.n ?? 0,
    staff: staffCount?.n ?? 0,
    classes: classCount?.n ?? 0,
    sections: sectionCount?.n ?? 0,
    subjects: subjectCount?.n ?? 0,
    enrollmentsByStatus,
    announcementsByStatus,
    eventsUpcoming: eventCounts?.upcoming ?? 0,
    eventsPast: eventCounts?.past ?? 0,
    sessionId: query.sessionId ?? null,
    termId: query.termId ?? null,
  }
}

// ---------------------------------------------------------------------------
// Attendance report (per-class aggregate within scope)
// ---------------------------------------------------------------------------
export async function getAttendanceReport(
  query: AttendanceOverviewReportQuery,
): Promise<AttendanceReportClassRow[]> {
  const client = await db()

  // Build the session-level WHERE; record-level filters join through
  // attendanceSessions.
  const sessionWhere: SQL[] = []
  if (query.sessionId) {
    sessionWhere.push(eq(attendanceSessions.sessionId, query.sessionId))
  }
  if (query.termId) {
    sessionWhere.push(eq(attendanceSessions.termId, query.termId))
  }
  if (query.classId) {
    sessionWhere.push(eq(attendanceSessions.classId, query.classId))
  }
  if (query.dateFrom) {
    sessionWhere.push(sql`${attendanceSessions.date} >= ${query.dateFrom}`)
  }
  if (query.dateTo) {
    sessionWhere.push(sql`${attendanceSessions.date} <= ${query.dateTo}`)
  }

  const rows = await client
    .select({
      classId: attendanceSessions.classId,
      className: classes.name,
      present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
      absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
      late: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'late')::int`,
      excused: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'excused')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(attendanceRecords)
    .innerJoin(
      attendanceSessions,
      eq(attendanceRecords.attendanceSessionId, attendanceSessions.id),
    )
    .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
    .where(all(sessionWhere))
    .groupBy(attendanceSessions.classId, classes.name)
    .orderBy(classes.name)

  return rows.map((r) => ({
    classId: r.classId,
    className: r.className,
    present: r.present,
    absent: r.absent,
    late: r.late,
    excused: r.excused,
    total: r.total,
    // Rate is (present + late) / total, with 2 decimal places, as a
    // NUMERIC string. 0 / null total -> "0.00".
    rate: (
      Math.round(
        ((r.present + r.late) / (r.total || 1)) * 10000,
      ) / 100
    ).toFixed(2),
  }))
}

// ---------------------------------------------------------------------------
// Enrollments report (per class x status)
// ---------------------------------------------------------------------------
export async function getEnrollmentReport(
  query: EnrollmentReportQuery,
): Promise<EnrollmentReportRow[]> {
  const client = await db()

  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(studentEnrollments.sessionId, query.sessionId))
  }
  if (query.classId) {
    where.push(eq(studentEnrollments.classId, query.classId))
  }
  if (query.status) {
    where.push(eq(studentEnrollments.status, query.status))
  }

  const rows = await client
    .select({
      classId: studentEnrollments.classId,
      className: classes.name,
      status: studentEnrollments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(studentEnrollments)
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .where(all(where))
    .groupBy(studentEnrollments.classId, classes.name, studentEnrollments.status)
    .orderBy(classes.name, studentEnrollments.status)

  return rows.map((r) => ({
    classId: r.classId,
    className: r.className,
    status: r.status,
    count: r.count,
  }))
}

// ---------------------------------------------------------------------------
// Audit log list (manual pagination + LEFT JOIN users)
// ---------------------------------------------------------------------------
export async function listAuditLogs(
  query: AuditLogListQuery,
): Promise<{
  data: AuditLogListItem[]
  meta: {
    currentPage: number
    perPage: number
    total: number
    lastPage: number
  }
}> {
  const client = await db()

  const where: Array<SQL | undefined> = [
    query.action ? eq(auditLogs.action, query.action) : undefined,
    query.resource ? eq(auditLogs.resource, query.resource) : undefined,
    query.userId ? eq(auditLogs.userId, query.userId) : undefined,
  ]
  if (query.dateFrom) {
    where.push(sql`${auditLogs.createdAt} >= ${query.dateFrom}::timestamptz`)
  }
  if (query.dateTo) {
    // Inclusive end of day.
    where.push(sql`${auditLogs.createdAt} <= (${query.dateTo}::date + interval '1 day')`)
  }
  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`
    where.push(
      or(
        ilike(auditLogs.description, pattern),
        ilike(auditLogs.action, pattern),
      ) ?? undefined,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  // Honor the explicit `order` param (asc = oldest first, desc = newest
  // first). The audit-logs UI defaults its own request to `?order=desc`.
  const order =
    query.order === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt)

  const rows = await client
    .select({
      log: auditLogs,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(filter)
    .orderBy(order)
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const data: AuditLogListItem[] = rows.map((r) => ({
    ...toJsonModel<AuditLog>(r.log),
    userName: r.userName ?? null,
    userEmail: r.userEmail ?? null,
  }))

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

// Suppress unused-export lint for the status tuples (kept for clarity /
// future use in tests that want to enumerate enum members).
export const ENROLLMENT_STATUSES_LIST = ENROLLMENT_STATUSES
export const ANNOUNCEMENT_STATUSES_LIST = ANNOUNCEMENT_STATUSES
export const ATTENDANCE_STATUSES_LIST = ATTENDANCE_STATUSES
