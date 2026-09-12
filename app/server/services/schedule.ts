/**
 * Timetable and attendance services (README §15–16, Phase 5).
 *
 * Timetable: weekly lesson entries with server-side conflict detection
 * (teacher double-booked, class double-booked, room double-booked). A
 * session-wide entry (no term) clashes with term-specific slots and a
 * whole-class entry (no section) clashes with section-specific slots;
 * back-to-back slots (one ends exactly when the next starts) are
 * allowed.
 *
 * Attendance: one register (attendance session) per class/section/date,
 * a per-student record set, and an open -> submitted -> approved
 * workflow. Approved registers are locked. Reports return present/
 * absent/late/excused counts and an attendance rate.
 */
import {
  and,
  asc,
  desc,
  eq,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  academicSessions,
  attendanceRecords,
  attendanceSessions,
  classes,
  sections,
  studentEnrollments,
  students,
  subjects,
  teachers,
  terms,
  timetableEntries,
} from '../../database/schema'
import type {
  AttendanceMarkBody,
  AttendanceReportQuery,
  AttendanceSessionCreate,
  AttendanceSessionListQuery,
  AttendanceSessionUpdate,
  StudentAttendanceQuery,
  TimetableCreate,
  TimetableListQuery,
  TimetableUpdate,
} from '../../shared/schemas'
import type {
  AttendanceRecordDetail,
  AttendanceReportRow,
  AttendanceSessionDetail,
  AttendanceSessionListItem,
  StudentAttendanceDay,
  StudentAttendanceSummary,
  TimetableEntry,
  TimetableEntryDetail,
  Weekday,
} from '../../shared/types'
import {
  isPgForeignKeyViolation,
  isPgUniqueViolation,
  smsConflict,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonList, toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const activeStudent = isNull(students.deletedAt)

// SQL order expression: Monday first ... Sunday last.
const weekdayOrder = sql`array_position(ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[], ${timetableEntries.weekday})`

// ---------------------------------------------------------------------------
// Reference validation (shared by timetable + attendance session writes)
// ---------------------------------------------------------------------------

interface ScopeRefs {
  sessionId: string
  termId?: string | null
  classId: string
  sectionId?: string | null
}

async function validateScopeRefs(
  client: SmsDb,
  refs: ScopeRefs,
): Promise<void> {
  const [session] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, refs.sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }
  if (refs.termId) {
    const [term] = await client
      .select({ id: terms.id, sessionId: terms.sessionId })
      .from(terms)
      .where(eq(terms.id, refs.termId))
      .limit(1)
    if (!term) {
      throw smsFieldError('termId', 'Term not found.')
    }
    if (term.sessionId !== refs.sessionId) {
      throw smsFieldError('termId', 'Term does not belong to the session.')
    }
  }
  const [klass] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, refs.classId))
    .limit(1)
  if (!klass) {
    throw smsFieldError('classId', 'Class not found.')
  }
  if (refs.sectionId) {
    const [section] = await client
      .select({ classId: sections.classId })
      .from(sections)
      .where(eq(sections.id, refs.sectionId))
      .limit(1)
    if (!section) {
      throw smsFieldError('sectionId', 'Section not found.')
    }
    if (section.classId !== refs.classId) {
      throw smsFieldError(
        'sectionId',
        'Section does not belong to the class.',
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

const timetableDetailSelect = {
  id: timetableEntries.id,
  sessionId: timetableEntries.sessionId,
  termId: timetableEntries.termId,
  classId: timetableEntries.classId,
  sectionId: timetableEntries.sectionId,
  subjectId: timetableEntries.subjectId,
  teacherId: timetableEntries.teacherId,
  room: timetableEntries.room,
  weekday: timetableEntries.weekday,
  startTime: timetableEntries.startTime,
  endTime: timetableEntries.endTime,
  createdAt: timetableEntries.createdAt,
  updatedAt: timetableEntries.updatedAt,
  className: classes.name,
  sectionName: sections.name,
  subjectName: subjects.name,
  teacherName: sql<string>`trim(concat(${teachers.firstName}, ' ', ${teachers.lastName}))`,
  sessionName: academicSessions.name,
  termName: terms.name,
}

function timetableDetailQuery(client: SmsDb) {
  return client
    .select(timetableDetailSelect)
    .from(timetableEntries)
    .innerJoin(classes, eq(timetableEntries.classId, classes.id))
    .leftJoin(sections, eq(timetableEntries.sectionId, sections.id))
    .innerJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
    .innerJoin(teachers, eq(timetableEntries.teacherId, teachers.id))
    .innerJoin(
      academicSessions,
      eq(timetableEntries.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(timetableEntries.termId, terms.id))
}

export async function listTimetableEntries(query: TimetableListQuery) {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(timetableEntries.sessionId, query.sessionId))
  }
  if (query.termId) {
    where.push(eq(timetableEntries.termId, query.termId))
  }
  if (query.classId) {
    where.push(eq(timetableEntries.classId, query.classId))
  }
  if (query.sectionId) {
    where.push(eq(timetableEntries.sectionId, query.sectionId))
  }
  if (query.teacherId) {
    where.push(eq(timetableEntries.teacherId, query.teacherId))
  }
  if (query.weekday) {
    where.push(eq(timetableEntries.weekday, query.weekday))
  }
  const rows = await timetableDetailQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(weekdayOrder, asc(timetableEntries.startTime))
  return {
    data: toJsonList<TimetableEntryDetail>(rows),
    total: rows.length,
  }
}

export async function getTimetableEntryOrThrow(
  id: string,
): Promise<TimetableEntryDetail> {
  const client = await db()
  const [row] = await timetableDetailQuery(client)
    .where(eq(timetableEntries.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Timetable entry not found.')
  }
  return toJsonModel<TimetableEntryDetail>(row)
}

// Half-open overlap against the candidate slot, scoped to the same
// weekday and session.
function overlapsSlot(
  startTime: string,
  endTime: string,
): SQL {
  return sql`${timetableEntries.startTime} < ${endTime}::time AND ${timetableEntries.endTime} > ${startTime}::time`
}

// Term/section scope: a whole-session or whole-class entry (null)
// overlaps every specific term/section; a specific one only matches its
// own plus the null (broad) entries.
function termScope(termId: string | null | undefined): SQL | undefined {
  if (termId) {
    return or(eq(timetableEntries.termId, termId), isNull(timetableEntries.termId))
  }
  return undefined
}

function sectionScope(sectionId: string | null | undefined): SQL | undefined {
  if (sectionId) {
    return or(
      eq(timetableEntries.sectionId, sectionId),
      isNull(timetableEntries.sectionId),
    )
  }
  return undefined
}

interface SlotCandidate {
  sessionId: string
  termId?: string | null
  classId: string
  sectionId?: string | null
  teacherId: string
  room?: string | null
  weekday: Weekday
  startTime: string
  endTime: string
}

async function assertNoConflicts(
  client: SmsDb,
  candidate: SlotCandidate,
  excludeId?: string,
): Promise<void> {
  const baseWhere: SQL[] = [
    eq(timetableEntries.sessionId, candidate.sessionId),
    eq(timetableEntries.weekday, candidate.weekday),
    overlapsSlot(candidate.startTime, candidate.endTime),
  ]
  if (excludeId) {
    baseWhere.push(sql`${timetableEntries.id} <> ${excludeId}::uuid`)
  }
  const termExpr = termScope(candidate.termId)
  if (termExpr) {
    baseWhere.push(termExpr)
  }
  const day = WEEKDAY_LABELS[candidate.weekday] ?? candidate.weekday
  const slot = `${candidate.startTime.slice(0, 5)}–${candidate.endTime.slice(0, 5)}`

  // 1. Teacher in two classes at once.
  const [teacherClash] = await client
    .select({ id: timetableEntries.id })
    .from(timetableEntries)
    .where(
      and(
        ...baseWhere,
        eq(timetableEntries.teacherId, candidate.teacherId),
      ),
    )
    .limit(1)
  if (teacherClash) {
    throw smsConflict(
      `This teacher already has a lesson on ${day} ${slot}.`,
    )
  }

  // 2. Class in two subjects at once.
  const classWhere: SQL[] = [
    ...baseWhere,
    eq(timetableEntries.classId, candidate.classId),
  ]
  const sectionExpr = sectionScope(candidate.sectionId)
  if (sectionExpr) {
    classWhere.push(sectionExpr)
  }
  const [classClash] = await client
    .select({ id: timetableEntries.id })
    .from(timetableEntries)
    .where(and(...classWhere))
    .limit(1)
  if (classClash) {
    throw smsConflict(
      `This class already has a lesson on ${day} ${slot}.`,
    )
  }

  // 3. Room used twice at once.
  if (candidate.room) {
    const [roomClash] = await client
      .select({ id: timetableEntries.id })
      .from(timetableEntries)
      .where(
        and(
          ...baseWhere,
          sql`lower(${timetableEntries.room}) = lower(${candidate.room})`,
        ),
      )
      .limit(1)
    if (roomClash) {
      throw smsConflict(
        `Room ${candidate.room} is already booked on ${day} ${slot}.`,
      )
    }
  }
}

export async function createTimetableEntry(
  input: TimetableCreate,
): Promise<TimetableEntryDetail> {
  const client = await db()
  await validateScopeRefs(client, input)

  const [subject] = await client
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, input.subjectId))
    .limit(1)
  if (!subject) {
    throw smsFieldError('subjectId', 'Subject not found.')
  }
  const [teacher] = await client
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(eq(teachers.id, input.teacherId), isNull(teachers.deletedAt)))
    .limit(1)
  if (!teacher) {
    throw smsFieldError('teacherId', 'Teacher not found.')
  }

  await assertNoConflicts(client, input)

  try {
    const [created] = await client
      .insert(timetableEntries)
      .values({
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        room: input.room?.trim() || null,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
      })
      .returning({ id: timetableEntries.id })
    if (!created) {
      throw smsConflict('Timetable entry could not be saved.')
    }
    return getTimetableEntryOrThrow(created.id)
  } catch (e) {
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

export async function updateTimetableEntry(
  id: string,
  input: TimetableUpdate,
): Promise<TimetableEntryDetail> {
  const client = await db()
  const existing = await getRawTimetableEntryOrThrow(client, id)

  // Merge payload onto the stored row so conflict/ref checks see the
  // resulting slot.
  const merged = {
    sessionId: input.sessionId ?? existing.sessionId,
    termId:
      input.termId !== undefined ? input.termId : existing.termId,
    classId: input.classId ?? existing.classId,
    sectionId:
      input.sectionId !== undefined
        ? input.sectionId
        : existing.sectionId,
    subjectId: input.subjectId ?? existing.subjectId,
    teacherId: input.teacherId ?? existing.teacherId,
    room: input.room !== undefined ? input.room : existing.room,
    weekday: input.weekday ?? existing.weekday,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
  }

  await validateScopeRefs(client, merged)
  if (input.subjectId) {
    const [subject] = await client
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, input.subjectId))
      .limit(1)
    if (!subject) {
      throw smsFieldError('subjectId', 'Subject not found.')
    }
  }
  if (input.teacherId) {
    const [teacher] = await client
      .select({ id: teachers.id })
      .from(teachers)
      .where(
        and(eq(teachers.id, input.teacherId), isNull(teachers.deletedAt)),
      )
      .limit(1)
    if (!teacher) {
      throw smsFieldError('teacherId', 'Teacher not found.')
    }
  }

  if (merged.endTime <= merged.startTime) {
    throw smsFieldError('endTime', 'endTime must be after startTime.')
  }
  await assertNoConflicts(client, merged, id)

  const values = { ...input, updatedAt: new Date() }
  if (values.room !== undefined) {
    values.room = values.room?.trim() || null
  }
  const [row] = await client
    .update(timetableEntries)
    .set(values)
    .where(eq(timetableEntries.id, id))
    .returning({ id: timetableEntries.id })
  if (!row) {
    throw smsNotFound('Timetable entry not found.')
  }
  return getTimetableEntryOrThrow(row.id)
}

async function getRawTimetableEntryOrThrow(
  client: SmsDb,
  id: string,
): Promise<TimetableEntry> {
  const [row] = await client
    .select()
    .from(timetableEntries)
    .where(eq(timetableEntries.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Timetable entry not found.')
  }
  return toJsonModel<TimetableEntry>(row)
}

export async function removeTimetableEntry(id: string): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(timetableEntries)
    .where(eq(timetableEntries.id, id))
    .returning({ id: timetableEntries.id })
  if (!row) {
    throw smsNotFound('Timetable entry not found.')
  }
}

// ---------------------------------------------------------------------------
// Attendance sessions
// ---------------------------------------------------------------------------

export async function listAttendanceSessions(query: AttendanceSessionListQuery) {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(attendanceSessions.sessionId, query.sessionId))
  }
  if (query.termId) {
    where.push(eq(attendanceSessions.termId, query.termId))
  }
  if (query.classId) {
    where.push(eq(attendanceSessions.classId, query.classId))
  }
  if (query.sectionId) {
    where.push(eq(attendanceSessions.sectionId, query.sectionId))
  }
  if (query.status) {
    where.push(eq(attendanceSessions.status, query.status))
  }
  if (query.dateFrom) {
    where.push(sql`${attendanceSessions.date} >= ${query.dateFrom}::date`)
  }
  if (query.dateTo) {
    where.push(sql`${attendanceSessions.date} <= ${query.dateTo}::date`)
  }
  const filter = where.length ? and(...where) : undefined
  const offset = (query.page - 1) * query.perPage

  const countRows = await client
    .select({ total: sql<number>`count(*)::int` })
    .from(attendanceSessions)
    .where(filter)
  const total = countRows[0]?.total ?? 0

  const rows = await client
    .select({
      id: attendanceSessions.id,
      sessionId: attendanceSessions.sessionId,
      termId: attendanceSessions.termId,
      classId: attendanceSessions.classId,
      sectionId: attendanceSessions.sectionId,
      date: attendanceSessions.date,
      status: attendanceSessions.status,
      markedById: attendanceSessions.markedById,
      approvedById: attendanceSessions.approvedById,
      approvedAt: attendanceSessions.approvedAt,
      notes: attendanceSessions.notes,
      createdAt: attendanceSessions.createdAt,
      updatedAt: attendanceSessions.updatedAt,
      className: classes.name,
      sectionName: sections.name,
      termName: terms.name,
      recordCount: sql<number>`count(${attendanceRecords.id})::int`,
    })
    .from(attendanceSessions)
    .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
    .leftJoin(sections, eq(attendanceSessions.sectionId, sections.id))
    .leftJoin(terms, eq(attendanceSessions.termId, terms.id))
    .leftJoin(
      attendanceRecords,
      eq(
        attendanceRecords.attendanceSessionId,
        attendanceSessions.id,
      ),
    )
    .where(filter)
    .groupBy(
      attendanceSessions.id,
      classes.name,
      sections.name,
      terms.name,
    )
    .orderBy(desc(attendanceSessions.date), desc(attendanceSessions.createdAt))
    .limit(query.perPage)
    .offset(offset)

  return {
    data: toJsonList<AttendanceSessionListItem>(rows),
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getAttendanceSessionOrThrow(
  id: string,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  const headerRows = await client
    .select({
      id: attendanceSessions.id,
      sessionId: attendanceSessions.sessionId,
      termId: attendanceSessions.termId,
      classId: attendanceSessions.classId,
      sectionId: attendanceSessions.sectionId,
      date: attendanceSessions.date,
      status: attendanceSessions.status,
      markedById: attendanceSessions.markedById,
      approvedById: attendanceSessions.approvedById,
      approvedAt: attendanceSessions.approvedAt,
      notes: attendanceSessions.notes,
      createdAt: attendanceSessions.createdAt,
      updatedAt: attendanceSessions.updatedAt,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(attendanceSessions)
    .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
    .leftJoin(sections, eq(attendanceSessions.sectionId, sections.id))
    .innerJoin(
      academicSessions,
      eq(attendanceSessions.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(attendanceSessions.termId, terms.id))
    .where(eq(attendanceSessions.id, id))
    .limit(1)
  const header = headerRows[0]
  if (!header) {
    throw smsNotFound('Attendance register not found.')
  }

  const recordRows = await client
    .select({
      id: attendanceRecords.id,
      attendanceSessionId: attendanceRecords.attendanceSessionId,
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
      remark: attendanceRecords.remark,
      createdAt: attendanceRecords.createdAt,
      updatedAt: attendanceRecords.updatedAt,
      studentName: sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      admissionNumber: students.admissionNumber,
    })
    .from(attendanceRecords)
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(eq(attendanceRecords.attendanceSessionId, id))
    .orderBy(asc(students.admissionNumber))

  return toJsonModel<AttendanceSessionDetail>({
    ...header,
    records: toJsonList<AttendanceRecordDetail>(recordRows),
  })
}
// Resolve the teacher profile linked to a login user (may be null for
// admins marking attendance).
async function resolveTeacherId(
  client: SmsDb,
  userId: string,
): Promise<string | null> {
  const [row] = await client
    .select({ id: teachers.id })
    .from(teachers)
    .where(eq(teachers.userId, userId))
    .limit(1)
  return row?.id ?? null
}

export async function createAttendanceSession(
  input: AttendanceSessionCreate,
  markerUserId: string,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  await validateScopeRefs(client, input)
  const markedById = await resolveTeacherId(client, markerUserId)

  try {
    const [created] = await client
      .insert(attendanceSessions)
      .values({
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        date: input.date,
        notes: input.notes ?? null,
        markedById,
      })
      .returning({ id: attendanceSessions.id })
    if (!created) {
      throw smsConflict('Attendance register could not be saved.')
    }
    return getAttendanceSessionOrThrow(created.id)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict(
        'An attendance register already exists for this class/section and date.',
      )
    }
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

// Students enrolled in the register's class for its session (active
// enrollments). When the register targets a section, whole-class
// enrollments are included as well.
async function enrolledStudentIds(
  client: SmsDb,
  register: {
    sessionId: string
    classId: string
    sectionId: string | null
  },
): Promise<Set<string>> {
  const where: SQL[] = [
    eq(studentEnrollments.sessionId, register.sessionId),
    eq(studentEnrollments.classId, register.classId),
    eq(studentEnrollments.status, 'active'),
  ]
  if (register.sectionId) {
    where.push(
      or(
        eq(studentEnrollments.sectionId, register.sectionId),
        isNull(studentEnrollments.sectionId),
      )!,
    )
  }
  const rows = await client
    .select({ studentId: studentEnrollments.studentId })
    .from(studentEnrollments)
    .where(and(...where))
  return new Set(rows.map((r) => r.studentId))
}

export async function markAttendance(
  id: string,
  input: AttendanceMarkBody,
  markerUserId: string,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  const [register] = await client
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, id))
    .limit(1)
  if (!register) {
    throw smsNotFound('Attendance register not found.')
  }
  if (register.status === 'approved') {
    throw smsConflict('Approved attendance registers are locked.')
  }

  const allowedIds = await enrolledStudentIds(client, register)
  const invalid = input.records.filter((r) => !allowedIds.has(r.studentId))
  if (invalid.length > 0) {
    throw smsFieldError(
      'records',
      `${invalid.length} student(s) are not enrolled in this class for the session.`,
    )
  }

  // Duplicate student rows in the same payload would violate the unique
  // index; reject with a clear message.
  const seen = new Set<string>()
  for (const record of input.records) {
    if (seen.has(record.studentId)) {
      throw smsFieldError('records', 'Duplicate student in marking payload.')
    }
    seen.add(record.studentId)
  }

  const markedById =
    register.markedById ?? (await resolveTeacherId(client, markerUserId))

  await client
    .insert(attendanceRecords)
    .values(
      input.records.map((record) => ({
        attendanceSessionId: id,
        studentId: record.studentId,
        status: record.status,
        remark: record.remark ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [
        attendanceRecords.attendanceSessionId,
        attendanceRecords.studentId,
      ],
      set: {
        status: sql`excluded.status`,
        remark: sql`excluded.remark`,
        updatedAt: new Date(),
      },
    })

  await client
    .update(attendanceSessions)
    .set({ markedById, updatedAt: new Date() })
    .where(eq(attendanceSessions.id, id))

  return getAttendanceSessionOrThrow(id)
}

export async function updateAttendanceSession(
  id: string,
  input: AttendanceSessionUpdate,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  const [row] = await client
    .update(attendanceSessions)
    .set({ notes: input.notes, updatedAt: new Date() })
    .where(eq(attendanceSessions.id, id))
    .returning({ id: attendanceSessions.id })
  if (!row) {
    throw smsNotFound('Attendance register not found.')
  }
  return getAttendanceSessionOrThrow(row.id)
}

export async function submitAttendanceSession(
  id: string,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  const [existing] = await client
    .select({ status: attendanceSessions.status })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, id))
    .limit(1)
  if (!existing) {
    throw smsNotFound('Attendance register not found.')
  }
  if (existing.status !== 'open') {
    throw smsConflict(`Only open registers can be submitted (currently ${existing.status}).`)
  }
  await client
    .update(attendanceSessions)
    .set({ status: 'submitted', updatedAt: new Date() })
    .where(eq(attendanceSessions.id, id))
  return getAttendanceSessionOrThrow(id)
}

export async function approveAttendanceSession(
  id: string,
  approverUserId: string,
): Promise<AttendanceSessionDetail> {
  const client = await db()
  const [existing] = await client
    .select({ status: attendanceSessions.status })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, id))
    .limit(1)
  if (!existing) {
    throw smsNotFound('Attendance register not found.')
  }
  if (existing.status !== 'submitted') {
    throw smsConflict(
      `Only submitted registers can be approved (currently ${existing.status}).`,
    )
  }
  const approvedById = await resolveTeacherId(client, approverUserId)
  await client
    .update(attendanceSessions)
    .set({
      status: 'approved',
      approvedById,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(attendanceSessions.id, id))
  return getAttendanceSessionOrThrow(id)
}

export async function removeAttendanceSession(id: string): Promise<void> {
  const client = await db()
  const [existing] = await client
    .select({ status: attendanceSessions.status })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, id))
    .limit(1)
  if (!existing) {
    throw smsNotFound('Attendance register not found.')
  }
  if (existing.status !== 'open') {
    throw smsConflict('Only open registers can be deleted.')
  }
  await client.delete(attendanceSessions).where(eq(attendanceSessions.id, id))
}

// ---------------------------------------------------------------------------
// Attendance reports
// ---------------------------------------------------------------------------

function rate(present: number, late: number, total: number): number | null {
  if (total === 0) {
    return null
  }
  return Math.round(((present + late) / total) * 1000) / 10
}

export async function attendanceClassReport(
  query: AttendanceReportQuery,
): Promise<AttendanceReportRow[]> {
  const client = await db()

  const sessionMatch: SQL[] = [
    eq(attendanceSessions.sessionId, query.sessionId),
    eq(attendanceSessions.classId, query.classId),
  ]
  if (query.termId) {
    sessionMatch.push(
      or(
        eq(attendanceSessions.termId, query.termId),
        isNull(attendanceSessions.termId),
      )!,
    )
  }
  if (query.sectionId) {
    sessionMatch.push(
      or(
        eq(attendanceSessions.sectionId, query.sectionId),
        isNull(attendanceSessions.sectionId),
      )!,
    )
  }

  const rows = await client
    .select({
      studentId: students.id,
      admissionNumber: students.admissionNumber,
      studentName: sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      total: sql<number>`count(${attendanceRecords.id})::int`,
      present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
      absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
      late: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'late')::int`,
      excused: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'excused')::int`,
    })
    .from(studentEnrollments)
    .innerJoin(
      students,
      and(
        eq(studentEnrollments.studentId, students.id),
        activeStudent,
      ),
    )
    .leftJoin(
      attendanceSessions,
      and(...sessionMatch),
    )
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.attendanceSessionId, attendanceSessions.id),
        eq(attendanceRecords.studentId, studentEnrollments.studentId),
      ),
    )
    .where(
      and(
        eq(studentEnrollments.sessionId, query.sessionId),
        eq(studentEnrollments.classId, query.classId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .groupBy(students.id, students.admissionNumber, students.firstName, students.lastName)
    .orderBy(asc(students.admissionNumber))

  return toJsonList<AttendanceReportRow>(rows).map((row) => ({
    ...row,
    attendanceRate: rate(row.present, row.late, row.total),
  }))
}

export async function studentAttendance(
  studentId: string,
  query: StudentAttendanceQuery,
): Promise<{ summary: StudentAttendanceSummary; data: StudentAttendanceDay[] }> {
  const client = await db()
  const [student] = await client
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), activeStudent))
    .limit(1)
  if (!student) {
    throw smsNotFound('Student not found.')
  }

  const where: SQL[] = [
    eq(attendanceRecords.studentId, studentId),
    eq(attendanceSessions.sessionId, query.sessionId),
  ]
  if (query.termId) {
    where.push(
      or(
        eq(attendanceSessions.termId, query.termId),
        isNull(attendanceSessions.termId),
      )!,
    )
  }

  const rows = await client
    .select({
      attendanceSessionId: attendanceSessions.id,
      date: attendanceSessions.date,
      status: attendanceRecords.status,
      remark: attendanceRecords.remark,
      className: classes.name,
      sectionName: sections.name,
      sessionStatus: attendanceSessions.status,
    })
    .from(attendanceRecords)
    .innerJoin(
      attendanceSessions,
      eq(attendanceRecords.attendanceSessionId, attendanceSessions.id),
    )
    .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
    .leftJoin(sections, eq(attendanceSessions.sectionId, sections.id))
    .where(and(...where))
    .orderBy(desc(attendanceSessions.date))

  const data = toJsonList<StudentAttendanceDay>(rows)
  const summary: StudentAttendanceSummary = {
    total: data.length,
    present: data.filter((d) => d.status === 'present').length,
    absent: data.filter((d) => d.status === 'absent').length,
    late: data.filter((d) => d.status === 'late').length,
    excused: data.filter((d) => d.status === 'excused').length,
    attendanceRate: null,
  }
  summary.attendanceRate = rate(summary.present, summary.late, summary.total)
  return { summary, data }
}
