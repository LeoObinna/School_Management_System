/**
 * Teacher academic services (README §3/§13 — Phase 3).
 *
 * Teacher<->subject capability links and teacher class assignments
 * (teacher + class/[section] + subject + session). All referential
 * rules are enforced here: sections must belong to the class, the
 * subject must be offered by the class, and duplicate assignments are
 * rejected. Teacher profile CRUD itself arrives in Phase 4.
 */
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import {
  teachers,
  subjects,
  classes,
  sections,
  academicSessions,
  classSubjects,
  teacherSubjects,
  teacherClassAssignments,
} from '../../database/schema'
import type {
  TeacherAssignmentCreate,
  TeacherAssignmentListQuery,
  TeacherSubjectBody,
} from '../../shared/schemas'
import type {
  TeacherClassAssignmentDetail,
  TeacherSubject as TeacherSubjectRow,
  TeacherSubjectDetail,
} from '../../shared/types'
import { smsConflict, smsFieldError, smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonList, toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Teacher lookup (minimal read support; full CRUD is Phase 4)
// ---------------------------------------------------------------------------

export interface TeacherLookup {
  id: string
  staffNumber: string
  name: string
}

export async function listActiveTeachers(): Promise<TeacherLookup[]> {
  const client = await db()
  const rows = await client
    .select({
      id: teachers.id,
      staffNumber: teachers.staffNumber,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
    })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(asc(teachers.firstName), asc(teachers.lastName))
  return rows.map((r) => ({
    id: r.id,
    staffNumber: r.staffNumber,
    name: `${r.firstName} ${r.lastName}`.trim(),
  }))
}

async function assertTeacherExists(
  client: SmsDb,
  teacherId: string,
): Promise<void> {
  const [row] = await client
    .select({ marker: sql`1` })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1)
  if (!row) {
    throw smsFieldError('teacherId', 'Teacher not found.')
  }
}

// ---------------------------------------------------------------------------
// Teacher <-> Subject capability links
// ---------------------------------------------------------------------------

export async function listTeacherSubjects(
  teacherId: string,
): Promise<TeacherSubjectDetail[]> {
  const client = await db()
  await assertTeacherExists(client, teacherId)
  const rows = await client
    .select({
      teacherId: teacherSubjects.teacherId,
      subjectId: teacherSubjects.subjectId,
      createdAt: teacherSubjects.createdAt,
      subject: subjects,
    })
    .from(teacherSubjects)
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
    .where(eq(teacherSubjects.teacherId, teacherId))
    .orderBy(asc(subjects.name))
  return toJsonList<TeacherSubjectDetail>(rows)
}

export async function addTeacherSubject(
  input: TeacherSubjectBody,
): Promise<TeacherSubjectRow> {
  const client = await db()
  await assertTeacherExists(client, input.teacherId)
  const [subject] = await client
    .select({ marker: sql`1` })
    .from(subjects)
    .where(eq(subjects.id, input.subjectId))
    .limit(1)
  if (!subject) {
    throw smsFieldError('subjectId', 'Subject not found.')
  }

  const [existing] = await client
    .select({ marker: sql`1` })
    .from(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherId, input.teacherId),
        eq(teacherSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1)
  if (existing) {
    throw smsConflict('Teacher is already linked to this subject.')
  }

  const [row] = await client
    .insert(teacherSubjects)
    .values({ teacherId: input.teacherId, subjectId: input.subjectId })
    .returning()
  return toJsonModel<TeacherSubjectRow>(row)
}

export async function removeTeacherSubject(
  teacherId: string,
  subjectId: string,
): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId),
      ),
    )
    .returning({ teacherId: teacherSubjects.teacherId })
  if (!row) {
    throw smsNotFound('Teacher subject link not found.')
  }
}

// ---------------------------------------------------------------------------
// Teacher class assignments
// ---------------------------------------------------------------------------

const assignmentDetailSelect = {
  id: teacherClassAssignments.id,
  teacherId: teacherClassAssignments.teacherId,
  classId: teacherClassAssignments.classId,
  sectionId: teacherClassAssignments.sectionId,
  subjectId: teacherClassAssignments.subjectId,
  sessionId: teacherClassAssignments.sessionId,
  isPrimaryTeacher: teacherClassAssignments.isPrimaryTeacher,
  createdAt: teacherClassAssignments.createdAt,
  teacherName: sql<string>`trim(${teachers.firstName} || ' ' || ${teachers.lastName})`,
  className: classes.name,
  sectionName: sections.name,
  subjectName: subjects.name,
  sessionName: academicSessions.name,
}

function assignmentDetailQuery(client: SmsDb) {
  return client
    .select(assignmentDetailSelect)
    .from(teacherClassAssignments)
    .innerJoin(
      teachers,
      eq(teacherClassAssignments.teacherId, teachers.id),
    )
    .innerJoin(classes, eq(teacherClassAssignments.classId, classes.id))
    .leftJoin(
      sections,
      eq(teacherClassAssignments.sectionId, sections.id),
    )
    .innerJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
    .innerJoin(
      academicSessions,
      eq(teacherClassAssignments.sessionId, academicSessions.id),
    )
}

export async function listAssignments(
  filters: TeacherAssignmentListQuery,
): Promise<TeacherClassAssignmentDetail[]> {
  const client = await db()
  const where: SQL[] = []
  if (filters.teacherId) {
    where.push(eq(teacherClassAssignments.teacherId, filters.teacherId))
  }
  if (filters.classId) {
    where.push(eq(teacherClassAssignments.classId, filters.classId))
  }
  if (filters.sectionId) {
    where.push(eq(teacherClassAssignments.sectionId, filters.sectionId))
  }
  if (filters.subjectId) {
    where.push(eq(teacherClassAssignments.subjectId, filters.subjectId))
  }
  if (filters.sessionId) {
    where.push(eq(teacherClassAssignments.sessionId, filters.sessionId))
  }
  const rows = await assignmentDetailQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      asc(academicSessions.name),
      asc(classes.name),
      asc(subjects.name),
    )
  return toJsonList<TeacherClassAssignmentDetail>(rows)
}

export async function createAssignment(
  input: TeacherAssignmentCreate,
): Promise<TeacherClassAssignmentDetail> {
  const client = await db()

  await assertTeacherExists(client, input.teacherId)

  const [klass] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, input.classId))
    .limit(1)
  if (!klass) {
    throw smsFieldError('classId', 'Class not found.')
  }

  const [session] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, input.sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }

  const [subject] = await client
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, input.subjectId))
    .limit(1)
  if (!subject) {
    throw smsFieldError('subjectId', 'Subject not found.')
  }

  if (input.sectionId) {
    const [section] = await client
      .select({ classId: sections.classId })
      .from(sections)
      .where(eq(sections.id, input.sectionId))
      .limit(1)
    if (!section) {
      throw smsFieldError('sectionId', 'Section not found.')
    }
    if (section.classId !== input.classId) {
      throw smsFieldError('sectionId', 'Section does not belong to the class.')
    }
  }

  // The subject must be offered by the class.
  const [classSubject] = await client
    .select({ marker: sql`1` })
    .from(classSubjects)
    .where(
      and(
        eq(classSubjects.classId, input.classId),
        eq(classSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1)
  if (!classSubject) {
    throw smsFieldError(
      'subjectId',
      'Subject is not offered by the selected class.',
    )
  }

  // Duplicate guard (NULL sections compare via IS NULL).
  const duplicateFilters: SQL[] = [
    eq(teacherClassAssignments.teacherId, input.teacherId),
    eq(teacherClassAssignments.classId, input.classId),
    eq(teacherClassAssignments.subjectId, input.subjectId),
    eq(teacherClassAssignments.sessionId, input.sessionId),
    input.sectionId
      ? eq(teacherClassAssignments.sectionId, input.sectionId)
      : isNull(teacherClassAssignments.sectionId),
  ]
  const [duplicate] = await client
    .select({ marker: sql`1` })
    .from(teacherClassAssignments)
    .where(and(...duplicateFilters))
    .limit(1)
  if (duplicate) {
    throw smsConflict('Teacher is already assigned to this class subject.')
  }

  const [created] = await client
    .insert(teacherClassAssignments)
    .values({
      teacherId: input.teacherId,
      classId: input.classId,
      sectionId: input.sectionId ?? null,
      subjectId: input.subjectId,
      sessionId: input.sessionId,
      isPrimaryTeacher: input.isPrimaryTeacher ?? false,
    })
    .returning({ id: teacherClassAssignments.id })

  const [detail] = await assignmentDetailQuery(client).where(
    eq(teacherClassAssignments.id, created!.id),
  )
  if (!detail) {
    throw smsNotFound('Created teacher assignment not found.')
  }
  return toJsonModel<TeacherClassAssignmentDetail>(detail)
}

export async function removeAssignment(id: string): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(teacherClassAssignments)
    .where(eq(teacherClassAssignments.id, id))
    .returning({ id: teacherClassAssignments.id })
  if (!row) {
    throw smsNotFound('Teacher assignment not found.')
  }
}
