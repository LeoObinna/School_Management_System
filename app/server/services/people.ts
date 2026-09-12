/**
 * People services (README §14, Phase 4).
 *
 * Students, parents, teachers and staff profile CRUD, student-parent
 * guardian links and student enrollment lifecycle. Person profiles are
 * soft-deleted (`deletedAt`) so historical academic/financial records
 * keep their references. Enrollment records carry full session/term/
 * class/section context and are never inferred from the student's
 * current placement convenience column.
 */
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  students,
  parents,
  teachers,
  staffProfiles,
  studentParents,
  studentEnrollments,
  classes,
  sections,
  academicSessions,
  terms,
} from '../../database/schema'
import type {
  EnrollmentCreate,
  EnrollmentListQuery,
  EnrollmentUpdate,
  ParentCreate,
  ParentListQuery,
  ParentUpdate,
  StaffCreate,
  StaffListQuery,
  StaffUpdate,
  StudentCreate,
  StudentListQuery,
  StudentParentBody,
  StudentParentUpdate,
  StudentUpdate,
  TeacherCreate,
  TeacherListQuery,
  TeacherUpdate,
} from '../../shared/schemas'
import type {
  Parent,
  ParentChildDetail,
  StaffProfile,
  Student,
  StudentEnrollmentDetail,
  StudentParent as StudentParentRow,
  StudentParentDetail,
  Teacher,
} from '../../shared/types'
import {
  isPgForeignKeyViolation,
  isPgUniqueViolation,
  smsConflict,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import { smsPaginate, type SmsDb } from '../utils/pagination'
import { toJsonList, toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// Escapes a user search term for an ILIKE pattern.
function like(search: string): string {
  return `%${search.replace(/[\\%_]/g, '\\$&')}%`
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

const activeStudent = isNull(students.deletedAt)

export async function listStudents(
  query: StudentListQuery,
) {
  const client = await db()
  const where: SQL[] = [activeStudent]
  if (query.status) {
    where.push(eq(students.status, query.status))
  }
  if (query.currentClassId) {
    where.push(eq(students.currentClassId, query.currentClassId))
  }
  if (query.search) {
    const pattern = like(query.search)
    const searchExpr = or(
      ilike(students.firstName, pattern),
      ilike(students.lastName, pattern),
      ilike(students.admissionNumber, pattern),
    )
    if (searchExpr) {
      where.push(searchExpr)
    }
  }
  return smsPaginate<Student>(client, {
    table: students,
    where: and(...where),
    orderBy: [asc(students.admissionNumber)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getStudentOrThrow(id: string): Promise<Student> {
  const client = await db()
  const [row] = await client
    .select()
    .from(students)
    .where(and(eq(students.id, id), activeStudent))
    .limit(1)
  if (!row) {
    throw smsNotFound('Student not found.')
  }
  return toJsonModel<Student>(row)
}

export async function createStudent(
  input: StudentCreate,
): Promise<Student> {
  const client = await db()
  const values = { ...input }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  try {
    const [row] = await client
      .insert(students)
      .values(values)
      .returning()
    return toJsonModel<Student>(row)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('A student with this admission number already exists.')
    }
    throw e
  }
}

export async function updateStudent(
  id: string,
  input: StudentUpdate,
): Promise<Student> {
  const client = await db()
  await getStudentOrThrow(id)
  const values = { ...input, updatedAt: new Date() }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  try {
    const [row] = await client
      .update(students)
      .set(values)
      .where(and(eq(students.id, id), activeStudent))
      .returning()
    if (!row) {
      throw smsNotFound('Student not found.')
    }
    return toJsonModel<Student>(row)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('A student with this admission number already exists.')
    }
    throw e
  }
}

export async function archiveStudent(id: string): Promise<Student> {
  const client = await db()
  await getStudentOrThrow(id)
  const [row] = await client
    .update(students)
    .set({ status: 'archived', deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(students.id, id), activeStudent))
    .returning()
  if (!row) {
    throw smsNotFound('Student not found.')
  }
  return toJsonModel<Student>(row)
}

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

const activeParent = isNull(parents.deletedAt)

export async function listParents(query: ParentListQuery) {
  const client = await db()
  const where: SQL[] = [activeParent]
  if (query.isActive !== undefined) {
    where.push(eq(parents.isActive, query.isActive))
  }
  if (query.search) {
    const pattern = like(query.search)
    const searchExpr = or(
      ilike(parents.firstName, pattern),
      ilike(parents.lastName, pattern),
      ilike(parents.email, pattern),
      ilike(parents.phone, pattern),
    )
    if (searchExpr) {
      where.push(searchExpr)
    }
  }
  return smsPaginate<Parent>(client, {
    table: parents,
    where: and(...where),
    orderBy: [asc(parents.firstName), asc(parents.lastName)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getParentOrThrow(id: string): Promise<Parent> {
  const client = await db()
  const [row] = await client
    .select()
    .from(parents)
    .where(and(eq(parents.id, id), activeParent))
    .limit(1)
  if (!row) {
    throw smsNotFound('Parent not found.')
  }
  return toJsonModel<Parent>(row)
}

export async function createParent(input: ParentCreate): Promise<Parent> {
  const client = await db()
  const values = { ...input }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  const [row] = await client.insert(parents).values(values).returning()
  return toJsonModel<Parent>(row)
}

export async function updateParent(
  id: string,
  input: ParentUpdate,
): Promise<Parent> {
  const client = await db()
  await getParentOrThrow(id)
  const values = { ...input, updatedAt: new Date() }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  const [row] = await client
    .update(parents)
    .set(values)
    .where(and(eq(parents.id, id), activeParent))
    .returning()
  if (!row) {
    throw smsNotFound('Parent not found.')
  }
  return toJsonModel<Parent>(row)
}

export async function deactivateParent(id: string): Promise<Parent> {
  const client = await db()
  await getParentOrThrow(id)
  const [row] = await client
    .update(parents)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(parents.id, id), activeParent))
    .returning()
  if (!row) {
    throw smsNotFound('Parent not found.')
  }
  return toJsonModel<Parent>(row)
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

const activeTeacher = isNull(teachers.deletedAt)

export async function listTeachers(query: TeacherListQuery) {
  const client = await db()
  const where: SQL[] = [activeTeacher]
  if (query.isActive !== undefined) {
    where.push(eq(teachers.isActive, query.isActive))
  }
  if (query.search) {
    const pattern = like(query.search)
    const searchExpr = or(
      ilike(teachers.firstName, pattern),
      ilike(teachers.lastName, pattern),
      ilike(teachers.staffNumber, pattern),
    )
    if (searchExpr) {
      where.push(searchExpr)
    }
  }
  return smsPaginate<Teacher>(client, {
    table: teachers,
    where: and(...where),
    orderBy: [asc(teachers.firstName), asc(teachers.lastName)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getTeacherOrThrow(id: string): Promise<Teacher> {
  const client = await db()
  const [row] = await client
    .select()
    .from(teachers)
    .where(and(eq(teachers.id, id), activeTeacher))
    .limit(1)
  if (!row) {
    throw smsNotFound('Teacher not found.')
  }
  return toJsonModel<Teacher>(row)
}

export async function createTeacher(input: TeacherCreate): Promise<Teacher> {
  const client = await db()
  const values = { ...input }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  try {
    const [row] = await client.insert(teachers).values(values).returning()
    return toJsonModel<Teacher>(row)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('A teacher with this staff number already exists.')
    }
    throw e
  }
}

export async function updateTeacher(
  id: string,
  input: TeacherUpdate,
): Promise<Teacher> {
  const client = await db()
  await getTeacherOrThrow(id)
  const values = { ...input, updatedAt: new Date() }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  try {
    const [row] = await client
      .update(teachers)
      .set(values)
      .where(and(eq(teachers.id, id), activeTeacher))
      .returning()
    if (!row) {
      throw smsNotFound('Teacher not found.')
    }
    return toJsonModel<Teacher>(row)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('A teacher with this staff number already exists.')
    }
    throw e
  }
}

export async function deactivateTeacher(id: string): Promise<Teacher> {
  const client = await db()
  await getTeacherOrThrow(id)
  const [row] = await client
    .update(teachers)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(teachers.id, id), activeTeacher))
    .returning()
  if (!row) {
    throw smsNotFound('Teacher not found.')
  }
  return toJsonModel<Teacher>(row)
}

// ---------------------------------------------------------------------------
// Staff profiles (non-teaching)
// ---------------------------------------------------------------------------

const activeStaff = isNull(staffProfiles.deletedAt)

export async function listStaff(query: StaffListQuery) {
  const client = await db()
  const where: SQL[] = [activeStaff]
  if (query.isActive !== undefined) {
    where.push(eq(staffProfiles.isActive, query.isActive))
  }
  if (query.search) {
    const pattern = like(query.search)
    const searchExpr = or(
      ilike(staffProfiles.firstName, pattern),
      ilike(staffProfiles.lastName, pattern),
      ilike(staffProfiles.staffNumber, pattern),
    )
    if (searchExpr) {
      where.push(searchExpr)
    }
  }
  return smsPaginate<StaffProfile>(client, {
    table: staffProfiles,
    where: and(...where),
    orderBy: [asc(staffProfiles.firstName), asc(staffProfiles.lastName)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getStaffOrThrow(id: string): Promise<StaffProfile> {
  const client = await db()
  const [row] = await client
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, id), activeStaff))
    .limit(1)
  if (!row) {
    throw smsNotFound('Staff member not found.')
  }
  return toJsonModel<StaffProfile>(row)
}

export async function createStaff(input: StaffCreate): Promise<StaffProfile> {
  const client = await db()
  const values = { ...input }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  const [row] = await client.insert(staffProfiles).values(values).returning()
  return toJsonModel<StaffProfile>(row)
}

export async function updateStaff(
  id: string,
  input: StaffUpdate,
): Promise<StaffProfile> {
  const client = await db()
  await getStaffOrThrow(id)
  const values = { ...input, updatedAt: new Date() }
  if (values.otherNames === '') {
    values.otherNames = undefined
  }
  const [row] = await client
    .update(staffProfiles)
    .set(values)
    .where(and(eq(staffProfiles.id, id), activeStaff))
    .returning()
  if (!row) {
    throw smsNotFound('Staff member not found.')
  }
  return toJsonModel<StaffProfile>(row)
}

export async function deactivateStaff(id: string): Promise<StaffProfile> {
  const client = await db()
  await getStaffOrThrow(id)
  const [row] = await client
    .update(staffProfiles)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(staffProfiles.id, id), activeStaff))
    .returning()
  if (!row) {
    throw smsNotFound('Staff member not found.')
  }
  return toJsonModel<StaffProfile>(row)
}

// ---------------------------------------------------------------------------
// Student <-> Parent links
// ---------------------------------------------------------------------------

export async function listStudentParents(
  studentId: string,
): Promise<StudentParentDetail[]> {
  const client = await db()
  await getStudentOrThrow(studentId)
  const rows = await client
    .select({
      studentId: studentParents.studentId,
      parentId: studentParents.parentId,
      relationship: studentParents.relationship,
      isPrimary: studentParents.isPrimary,
      isEmergencyContact: studentParents.isEmergencyContact,
      createdAt: studentParents.createdAt,
      parent: parents,
    })
    .from(studentParents)
    .innerJoin(parents, eq(studentParents.parentId, parents.id))
    .where(eq(studentParents.studentId, studentId))
    .orderBy(desc(studentParents.isPrimary), asc(parents.lastName))
  return toJsonList<StudentParentDetail>(rows)
}

export async function listParentChildren(
  parentId: string,
): Promise<ParentChildDetail[]> {
  const client = await db()
  await getParentOrThrow(parentId)
  const rows = await client
    .select({
      studentId: studentParents.studentId,
      parentId: studentParents.parentId,
      relationship: studentParents.relationship,
      isPrimary: studentParents.isPrimary,
      isEmergencyContact: studentParents.isEmergencyContact,
      createdAt: studentParents.createdAt,
      student: students,
    })
    .from(studentParents)
    .innerJoin(students, eq(studentParents.studentId, students.id))
    .where(eq(studentParents.parentId, parentId))
    .orderBy(asc(students.lastName))
  return toJsonList<ParentChildDetail>(rows)
}

export async function addStudentParent(
  studentId: string,
  input: StudentParentBody,
): Promise<StudentParentRow> {
  const client = await db()
  await getStudentOrThrow(studentId)
  await getParentOrThrow(input.parentId)
  const [existing] = await client
    .select({ marker: sql`1` })
    .from(studentParents)
    .where(
      and(
        eq(studentParents.studentId, studentId),
        eq(studentParents.parentId, input.parentId),
      ),
    )
    .limit(1)
  if (existing) {
    throw smsConflict('This parent is already linked to the student.')
  }
  const [row] = await client
    .insert(studentParents)
    .values({
      studentId,
      parentId: input.parentId,
      relationship: input.relationship,
      isPrimary: input.isPrimary ?? false,
      isEmergencyContact: input.isEmergencyContact ?? false,
    })
    .returning()
  return toJsonModel<StudentParentRow>(row)
}

export async function updateStudentParent(
  studentId: string,
  parentId: string,
  input: StudentParentUpdate,
): Promise<StudentParentRow> {
  const client = await db()
  const [row] = await client
    .update(studentParents)
    .set({ ...input })
    .where(
      and(
        eq(studentParents.studentId, studentId),
        eq(studentParents.parentId, parentId),
      ),
    )
    .returning()
  if (!row) {
    throw smsNotFound('Student-parent link not found.')
  }
  return toJsonModel<StudentParentRow>(row)
}

export async function removeStudentParent(
  studentId: string,
  parentId: string,
): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(studentParents)
    .where(
      and(
        eq(studentParents.studentId, studentId),
        eq(studentParents.parentId, parentId),
      ),
    )
    .returning({ parentId: studentParents.parentId })
  if (!row) {
    throw smsNotFound('Student-parent link not found.')
  }
}

// ---------------------------------------------------------------------------
// Student enrollments
// ---------------------------------------------------------------------------

const enrollmentDetailSelect = {
  id: studentEnrollments.id,
  studentId: studentEnrollments.studentId,
  sessionId: studentEnrollments.sessionId,
  termId: studentEnrollments.termId,
  classId: studentEnrollments.classId,
  sectionId: studentEnrollments.sectionId,
  rollNumber: studentEnrollments.rollNumber,
  enrollmentDate: studentEnrollments.enrollmentDate,
  status: studentEnrollments.status,
  notes: studentEnrollments.notes,
  createdAt: studentEnrollments.createdAt,
  updatedAt: studentEnrollments.updatedAt,
  studentName: sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
  className: classes.name,
  sectionName: sections.name,
  sessionName: academicSessions.name,
  termName: terms.name,
}

function enrollmentDetailQuery(client: SmsDb) {
  return client
    .select(enrollmentDetailSelect)
    .from(studentEnrollments)
    .innerJoin(
      students,
      eq(studentEnrollments.studentId, students.id),
    )
    .innerJoin(
      academicSessions,
      eq(studentEnrollments.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(studentEnrollments.termId, terms.id))
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(sections, eq(studentEnrollments.sectionId, sections.id))
}

export async function listEnrollments(query: EnrollmentListQuery) {
  const client = await db()
  const where: SQL[] = []
  if (query.studentId) {
    where.push(eq(studentEnrollments.studentId, query.studentId))
  }
  if (query.sessionId) {
    where.push(eq(studentEnrollments.sessionId, query.sessionId))
  }
  if (query.classId) {
    where.push(eq(studentEnrollments.classId, query.classId))
  }
  if (query.sectionId) {
    where.push(eq(studentEnrollments.sectionId, query.sectionId))
  }
  if (query.status) {
    where.push(eq(studentEnrollments.status, query.status))
  }
  const rows = await enrollmentDetailQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(studentEnrollments.enrollmentDate))
  return {
    data: toJsonList<StudentEnrollmentDetail>(rows),
    total: rows.length,
  }
}

export async function getEnrollmentOrThrow(
  id: string,
): Promise<StudentEnrollmentDetail> {
  const client = await db()
  const [row] = await enrollmentDetailQuery(client).where(
    eq(studentEnrollments.id, id),
  )
  if (!row) {
    throw smsNotFound('Enrollment not found.')
  }
  return toJsonModel<StudentEnrollmentDetail>(row)
}

export async function createEnrollment(
  input: EnrollmentCreate,
): Promise<StudentEnrollmentDetail> {
  const client = await db()

  await getStudentOrThrow(input.studentId)

  const [session] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, input.sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }

  if (input.termId) {
    const [term] = await client
      .select({ id: terms.id, sessionId: terms.sessionId })
      .from(terms)
      .where(eq(terms.id, input.termId))
      .limit(1)
    if (!term) {
      throw smsFieldError('termId', 'Term not found.')
    }
    if (term.sessionId !== input.sessionId) {
      throw smsFieldError('termId', 'Term does not belong to the session.')
    }
  }

  const [klass] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, input.classId))
    .limit(1)
  if (!klass) {
    throw smsFieldError('classId', 'Class not found.')
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

  try {
    const [created] = await client
      .insert(studentEnrollments)
      .values({
        studentId: input.studentId,
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        rollNumber: input.rollNumber ?? null,
        enrollmentDate: input.enrollmentDate,
        status: input.status ?? 'active',
        notes: input.notes ?? null,
      })
      .returning({ id: studentEnrollments.id })
    const [detail] = await enrollmentDetailQuery(client).where(
      eq(studentEnrollments.id, created!.id),
    )
    if (!detail) {
      throw smsNotFound('Created enrollment not found.')
    }
    return toJsonModel<StudentEnrollmentDetail>(detail)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict(
        'Student is already enrolled in this session/term/class/section.',
      )
    }
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('classId', 'Class not found.')
    }
    throw e
  }
}

export async function updateEnrollment(
  id: string,
  input: EnrollmentUpdate,
): Promise<StudentEnrollmentDetail> {
  const client = await db()
  await getEnrollmentOrThrow(id)

  if (input.sectionId && input.classId) {
    const [section] = await client
      .select({ classId: sections.classId })
      .from(sections)
      .where(eq(sections.id, input.sectionId))
      .limit(1)
    if (!section || section.classId !== input.classId) {
      throw smsFieldError('sectionId', 'Section does not belong to the class.')
    }
  }

  try {
    const [updated] = await client
      .update(studentEnrollments)
      .set({
        ...input,
        sectionId: input.sectionId ?? null,
        rollNumber: input.rollNumber ?? null,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(studentEnrollments.id, id))
      .returning({ id: studentEnrollments.id })
    if (!updated) {
      throw smsNotFound('Enrollment not found.')
    }
    return getEnrollmentOrThrow(id)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict(
        'Student is already enrolled in this session/term/class/section.',
      )
    }
    throw e
  }
}

export async function removeEnrollment(id: string): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(studentEnrollments)
    .where(eq(studentEnrollments.id, id))
    .returning({ id: studentEnrollments.id })
  if (!row) {
    throw smsNotFound('Enrollment not found.')
  }
}
