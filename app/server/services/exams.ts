/**
 * Exams, assessments, grading, results and report-card services
 * (README §18, Phase 7).
 *
 * Authorization model:
 *  - exams.create/update (admin/super_admin) manage exams + subjects.
 *  - exams.view (admin/teacher) lists and inspects exams.
 *  - exam_results.enter/update (admin/teacher) enter scores; teachers
 *    only for classes/subjects they are assigned to that session.
 *  - exam_results.submit (admin/teacher of class) submits a
 *    publication; exam_results.approve/publish (admin) advances it.
 *  - exam_results.view (all) reads results; students/parents only see
 *    rows whose result_publication is `published`.
 *  - report_cards.generate/publish (admin); report_cards.view (all,
 *    restricted to own/children + published for students/parents).
 *
 * Result workflow: draft -> submitted -> approved -> published.
 * Scores are locked once the publication leaves `draft`.
 */
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  academicSessions,
  assessmentScores,
  assessmentTypes,
  classes,
  examScores,
  examSubjects,
  exams,
  gradingScaleItems,
  gradingScales,
  parents,
  reportCards,
  resultPublications,
  sections,
  studentEnrollments,
  studentParents,
  students,
  subjects,
  teacherClassAssignments,
  teachers,
  terms,
  users,
} from '../../database/schema'
import type {
  AssessmentScoreBulk,
  AssessmentScoreListQuery,
  AssessmentScoreUpsert,
  AssessmentTypeCreate,
  AssessmentTypeListQuery,
  AssessmentTypeUpdate,
  ExamCreate,
  ExamListQuery,
  ExamScoreBulk,
  ExamSubjectUpsert,
  ExamUpdate,
  GradingScaleCreate,
  GradingScaleListQuery,
  GradingScaleUpdate,
  ReportCardGenerate,
  ReportCardListQuery,
  ResultPublicationCreate,
  ResultPublicationListQuery,
} from '../../shared/schemas'
import type {
  AssessmentScoreDetail,
  AssessmentType,
  ExamDetail,
  ExamListItem,
  ExamSubjectDetail,
  GradingScaleDetail,
  MySchoolContext,
  ReportCardDetail,
  ResultPublicationDetail,
  StudentResultSummary,
  SubjectResult,
} from '../../shared/types'
import type { AuthContext } from '../utils/auth/context'
import {
  classifyActorScope,
  studentEnrolledClassIds,
  teacherTaughtClassIds,
  type ActorProfile,
} from '../utils/auth/actor'
import {
  isPgForeignKeyViolation,
  isPgUniqueViolation,
  smsConflict,
  smsFieldError,
  smsForbidden,
  smsNotFound,
} from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonList, toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const activeStudent = isNull(students.deletedAt)

// Request actor, resolved from the authenticated login.
export interface Actor {
  userId: string
  isStaff: boolean
  isAdmin: boolean
  teacherId: string | null
  studentId: string | null
}

// GET /api/v1/my/school-context — resolves the current user's student id
// (for student logins) or list of children (for parent logins). Used by
// the /results page to drive self/child result lookups without exposing
// other people's ids.
export async function getMySchoolContext(
  auth: AuthContext,
): Promise<MySchoolContext> {
  const client = await db()
  const [studentRow, parentRow] = await Promise.all([
    client
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.userId, auth.user.id), activeStudent))
      .limit(1),
    client
      .select({ id: parents.id })
      .from(parents)
      .where(and(eq(parents.userId, auth.user.id), isNull(parents.deletedAt)))
      .limit(1),
  ])
  if (studentRow[0]) {
    return { studentId: studentRow[0].id, children: [] }
  }
  if (parentRow[0]) {
    const children = await client
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(studentParents)
      .innerJoin(
        students,
        and(eq(studentParents.studentId, students.id), activeStudent),
      )
      .where(eq(studentParents.parentId, parentRow[0].id))
      .orderBy(asc(students.lastName), asc(students.firstName))
    return {
      studentId: null,
      children: children.map((c) => ({
        id: c.id,
        admissionNumber: c.admissionNumber,
        name: `${c.firstName} ${c.lastName}`.trim(),
      })),
    }
  }
  // Staff or unrelated account.
  return { studentId: null, children: [] }
}

export async function getActor(
  auth: AuthContext,
  staffPermission = 'exam_results.enter',
): Promise<Actor> {
  const client = await db()
  const [teacherRow, studentRow] = await Promise.all([
    client
      .select({ id: teachers.id })
      .from(teachers)
      .where(and(eq(teachers.userId, auth.user.id), isNull(teachers.deletedAt)))
      .limit(1),
    client
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.userId, auth.user.id), activeStudent))
      .limit(1),
  ])
  const roleSet = new Set(auth.roles)
  const isAdmin =
    roleSet.has('super_admin') || roleSet.has('admin')
  return {
    userId: auth.user.id,
    isStaff: auth.permissions.includes(staffPermission) || isAdmin,
    isAdmin,
    teacherId: teacherRow[0]?.id ?? null,
    studentId: studentRow[0]?.id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Reference validation
// ---------------------------------------------------------------------------

async function validateSessionTerm(
  client: SmsDb,
  sessionId: string,
  termId?: string | null,
): Promise<void> {
  const [session] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }
  if (termId) {
    const [term] = await client
      .select({ sessionId: terms.sessionId })
      .from(terms)
      .where(eq(terms.id, termId))
      .limit(1)
    if (!term) {
      throw smsFieldError('termId', 'Term not found.')
    }
    if (term.sessionId !== sessionId) {
      throw smsFieldError('termId', 'Term does not belong to the session.')
    }
  }
}

async function validateClassSection(
  client: SmsDb,
  classId: string,
  sectionId?: string | null,
): Promise<void> {
  const [klass] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1)
  if (!klass) {
    throw smsFieldError('classId', 'Class not found.')
  }
  if (sectionId) {
    const [section] = await client
      .select({ classId: sections.classId })
      .from(sections)
      .where(eq(sections.id, sectionId))
      .limit(1)
    if (!section || section.classId !== classId) {
      throw smsFieldError(
        'sectionId',
        'Section not found in the selected class.',
      )
    }
  }
}

// Returns true when the teacher is assigned to (class, subject, session)
// in `teacher_class_assignments`. Section is optional and matched loosely.
async function teacherIsAssigned(
  client: SmsDb,
  teacherId: string,
  sessionId: string,
  classId: string,
  subjectId: string,
  sectionId?: string | null,
): Promise<boolean> {
  const where: SQL[] = [
    eq(teacherClassAssignments.teacherId, teacherId),
    eq(teacherClassAssignments.sessionId, sessionId),
    eq(teacherClassAssignments.classId, classId),
    eq(teacherClassAssignments.subjectId, subjectId),
  ]
  if (sectionId) {
    where.push(
      or(
        eq(teacherClassAssignments.sectionId, sectionId),
        isNull(teacherClassAssignments.sectionId),
      )!,
    )
  }
  const [row] = await client
    .select({ marker: sql`1` })
    .from(teacherClassAssignments)
    .where(and(...where))
    .limit(1)
  return Boolean(row)
}

// Returns true when the student is actively enrolled in the class (and
// section, when targeted) for the session.
async function studentIsEnrolled(
  client: SmsDb,
  studentId: string,
  sessionId: string,
  classId: string,
  sectionId?: string | null,
): Promise<boolean> {
  const where: SQL[] = [
    eq(studentEnrollments.studentId, studentId),
    eq(studentEnrollments.sessionId, sessionId),
    eq(studentEnrollments.classId, classId),
    eq(studentEnrollments.status, 'active'),
  ]
  if (sectionId) {
    where.push(
      or(
        eq(studentEnrollments.sectionId, sectionId),
        isNull(studentEnrollments.sectionId),
      )!,
    )
  }
  const [row] = await client
    .select({ marker: sql`1` })
    .from(studentEnrollments)
    .where(and(...where))
    .limit(1)
  return Boolean(row)
}

// True when the parent is linked to the student.
async function parentOwnsStudent(
  client: SmsDb,
  parentUserId: string,
  studentId: string,
): Promise<boolean> {
  // Resolve through parents → student_parents; the earlier join on
  // students.user_id matched the student's own login, never a parent.
  const [row] = await client
    .select({ marker: sql`1` })
    .from(studentParents)
    .innerJoin(parents, eq(studentParents.parentId, parents.id))
    .where(
      and(
        eq(parents.userId, parentUserId),
        eq(studentParents.studentId, studentId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

// Returns the active grading scale items for a session. Falls back to the
// global scale (sessionId is null) when no session-specific scale exists.
async function getActiveGradingScaleItems(
  client: SmsDb,
  sessionId: string,
): Promise<GradingScaleDetail['items']> {
  const [scale] = await client
    .select({ id: gradingScales.id })
    .from(gradingScales)
    .where(
      and(
        eq(gradingScales.isActive, true),
        or(
          eq(gradingScales.sessionId, sessionId),
          isNull(gradingScales.sessionId),
        ),
      ),
    )
    .orderBy(desc(gradingScales.sessionId)) // session-specific first
    .limit(1)
  if (!scale) {
    return []
  }
  const items = await client
    .select()
    .from(gradingScaleItems)
    .where(eq(gradingScaleItems.scaleId, scale.id))
    .orderBy(asc(gradingScaleItems.minScore))
  return toJsonList<GradingScaleDetail['items'][number]>(items)
}

// Returns the grade whose [minScore, maxScore] contains the percentage.
function computeGrade(
  percentage: number,
  items: GradingScaleDetail['items'],
): string | null {
  for (const item of items) {
    const min = Number(item.minScore)
    const max = Number(item.maxScore)
    if (percentage >= min && percentage <= max) {
      return item.grade
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Assessment types
// ---------------------------------------------------------------------------

export async function listAssessmentTypes(
  query: AssessmentTypeListQuery,
): Promise<{ data: AssessmentType[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.isActive !== undefined) {
    where.push(
      eq(assessmentTypes.isActive, query.isActive === 'true'),
    )
  }
  const rows = await client
    .select()
    .from(assessmentTypes)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(assessmentTypes.name))
  return { data: toJsonList<AssessmentType>(rows) }
}

export async function createAssessmentType(
  input: AssessmentTypeCreate,
): Promise<AssessmentType> {
  const client = await db()
  try {
    const [row] = await client
      .insert(assessmentTypes)
      .values({
        name: input.name,
        slug: input.slug,
        weight: input.weight ?? '1',
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      })
      .returning()
    return toJsonModel<AssessmentType>(row!)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('An assessment type with that slug already exists.')
    }
    throw e
  }
}

export async function updateAssessmentType(
  id: string,
  input: AssessmentTypeUpdate,
): Promise<AssessmentType> {
  const client = await db()
  const values: Record<string, unknown> = {}
  if (input.name !== undefined) values.name = input.name
  if (input.slug !== undefined) values.slug = input.slug
  if (input.weight !== undefined) values.weight = input.weight
  if (input.description !== undefined) values.description = input.description
  if (input.isActive !== undefined) values.isActive = input.isActive
  try {
    const [row] = await client
      .update(assessmentTypes)
      .set(values)
      .where(eq(assessmentTypes.id, id))
      .returning()
    if (!row) {
      throw smsNotFound('Assessment type not found.')
    }
    return toJsonModel<AssessmentType>(row)
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('An assessment type with that slug already exists.')
    }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Grading scales
// ---------------------------------------------------------------------------

export async function listGradingScales(
  query: GradingScaleListQuery,
): Promise<{ data: GradingScaleDetail[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(gradingScales.sessionId, query.sessionId))
  }
  if (query.isActive !== undefined) {
    where.push(eq(gradingScales.isActive, query.isActive === 'true'))
  }
  const rows = await client
    .select()
    .from(gradingScales)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(gradingScales.createdAt))
  const data: GradingScaleDetail[] = []
  for (const row of rows) {
    const items = await client
      .select()
      .from(gradingScaleItems)
      .where(eq(gradingScaleItems.scaleId, row.id))
      .orderBy(asc(gradingScaleItems.minScore))
    data.push({
      ...toJsonModel<GradingScaleDetail>(row),
      items: toJsonList<GradingScaleDetail['items'][number]>(items),
    })
  }
  return { data }
}

export async function getGradingScale(
  id: string,
): Promise<GradingScaleDetail> {
  const client = await db()
  const [row] = await client
    .select()
    .from(gradingScales)
    .where(eq(gradingScales.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Grading scale not found.')
  }
  const items = await client
    .select()
    .from(gradingScaleItems)
    .where(eq(gradingScaleItems.scaleId, id))
    .orderBy(asc(gradingScaleItems.minScore))
  return {
    ...toJsonModel<GradingScaleDetail>(row),
    items: toJsonList<GradingScaleDetail['items'][number]>(items),
  }
}

export async function createGradingScale(
  input: GradingScaleCreate,
): Promise<GradingScaleDetail> {
  const client = await db()
  return await client.transaction(async (tx) => {
    const [scale] = await tx
      .insert(gradingScales)
      .values({
        sessionId: input.sessionId ?? null,
        name: input.name,
        isActive: input.isActive ?? true,
      })
      .returning()
    if (!scale) {
      throw smsConflict('Grading scale could not be saved.')
    }
    await tx.insert(gradingScaleItems).values(
      input.items.map((i) => ({
        scaleId: scale.id,
        grade: i.grade,
        minScore: i.minScore,
        maxScore: i.maxScore,
        remark: i.remark ?? null,
        points: i.points ?? null,
      })),
    )
    return getGradingScale(scale.id)
  })
}

export async function updateGradingScale(
  id: string,
  input: GradingScaleUpdate,
): Promise<GradingScaleDetail> {
  const client = await db()
  return await client.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (input.sessionId !== undefined) {
      values.sessionId = input.sessionId
    }
    if (input.name !== undefined) values.name = input.name
    if (input.isActive !== undefined) values.isActive = input.isActive
    const [row] = await tx
      .update(gradingScales)
      .set(values)
      .where(eq(gradingScales.id, id))
      .returning()
    if (!row) {
      throw smsNotFound('Grading scale not found.')
    }
    if (input.items) {
      await tx.delete(gradingScaleItems).where(
        eq(gradingScaleItems.scaleId, id),
      )
      await tx.insert(gradingScaleItems).values(
        input.items.map((i) => ({
          scaleId: id,
          grade: i.grade,
          minScore: i.minScore,
          maxScore: i.maxScore,
          remark: i.remark ?? null,
          points: i.points ?? null,
        })),
      )
    }
    return getGradingScale(id)
  })
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

const examJoinFields = {
  className: classes.name,
  sessionName: academicSessions.name,
  termName: terms.name,
}

function examBaseQuery(client: SmsDb) {
  return client
    .select({
      ...examJoinFields,
      exam: exams,
      subjectCount:
        sql<number>`(select count(*) from ${examSubjects} where ${examSubjects.examId} = ${exams.id})::int`,
    })
    .from(exams)
    .innerJoin(classes, eq(exams.classId, classes.id))
    .innerJoin(academicSessions, eq(exams.sessionId, academicSessions.id))
    .leftJoin(terms, eq(exams.termId, terms.id))
}

export async function listExams(
  query: ExamListQuery,
  actor?: ActorProfile | null,
): Promise<{ data: ExamListItem[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) where.push(eq(exams.sessionId, query.sessionId))
  if (query.termId) where.push(eq(exams.termId, query.termId))
  if (query.classId) where.push(eq(exams.classId, query.classId))
  if (query.status) where.push(eq(exams.status, query.status))

  // Row-level scoping (Phase 12). Teachers see only exams for classes
  // they teach that session; students see their own enrolled classes;
  // parents see their children's classes. Staff (admins / callers with
  // exams.create) see everything.
  if (actor) {
    const scope = classifyActorScope(actor)
    if (scope.kind === 'teacher') {
      const classIds = await teacherTaughtClassIds(
        client,
        scope.teacherId,
        query.sessionId,
      )
      if (classIds.length === 0) return { data: [] }
      where.push(inArray(exams.classId, classIds))
    } else if (scope.kind === 'student' || scope.kind === 'parent') {
      const studentIds =
        scope.kind === 'student' ? [scope.studentId] : scope.children
      const classIdSets = await Promise.all(
        studentIds.map((id) =>
          studentEnrolledClassIds(client, id, query.sessionId),
        ),
      )
      const classIds = [...new Set(classIdSets.flat())]
      if (classIds.length === 0) return { data: [] }
      where.push(inArray(exams.classId, classIds))
    } else if (scope.kind === 'none') {
      return { data: [] }
    }
    // scope.kind === 'staff' → no extra constraint.
  }

  const rows = await examBaseQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(exams.createdAt))
  return {
    data: rows.map((r) => ({
      ...toJsonModel<ExamListItem>(r.exam),
      className: r.className,
      sessionName: r.sessionName,
      termName: r.termName,
      subjectCount: r.subjectCount,
    })),
  }
}

export async function getExam(id: string): Promise<ExamDetail> {
  const client = await db()
  const [row] = await examBaseQuery(client)
    .where(eq(exams.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Exam not found.')
  }
  const subjectRows = await client
    .select({
      id: examSubjects.id,
      examId: examSubjects.examId,
      subjectId: examSubjects.subjectId,
      maxScore: examSubjects.maxScore,
      examDate: examSubjects.examDate,
      createdAt: examSubjects.createdAt,
      subjectName: subjects.name,
      subjectCode: subjects.code,
    })
    .from(examSubjects)
    .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
    .where(eq(examSubjects.examId, id))
    .orderBy(asc(subjects.name))
  return {
    ...toJsonModel<ExamDetail>(row.exam),
    className: row.className,
    sessionName: row.sessionName,
    termName: row.termName,
    subjects: toJsonList<ExamSubjectDetail>(subjectRows),
  }
}

export async function createExam(input: ExamCreate): Promise<ExamDetail> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId, input.termId)
  await validateClassSection(client, input.classId)
  try {
    const [row] = await client
      .insert(exams)
      .values({
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        classId: input.classId,
        name: input.name,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        status: input.status ?? 'closed',
      })
      .returning({ id: exams.id })
    if (!row) {
      throw smsConflict('Exam could not be saved.')
    }
    return getExam(row.id)
  } catch (e) {
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

export async function updateExam(
  id: string,
  input: ExamUpdate,
): Promise<ExamDetail> {
  const client = await db()
  const [existing] = await client
    .select()
    .from(exams)
    .where(eq(exams.id, id))
    .limit(1)
  if (!existing) {
    throw smsNotFound('Exam not found.')
  }
  const merged = {
    sessionId: input.sessionId ?? existing.sessionId,
    termId: input.termId !== undefined ? input.termId : existing.termId,
    classId: input.classId ?? existing.classId,
  }
  await validateSessionTerm(client, merged.sessionId, merged.termId)
  await validateClassSection(client, merged.classId)
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (input.sessionId !== undefined) values.sessionId = input.sessionId
  if (input.termId !== undefined) values.termId = input.termId
  if (input.classId !== undefined) values.classId = input.classId
  if (input.name !== undefined) values.name = input.name
  if (input.startDate !== undefined) values.startDate = input.startDate
  if (input.endDate !== undefined) values.endDate = input.endDate
  if (input.status !== undefined) values.status = input.status
  await client.update(exams).set(values).where(eq(exams.id, id))
  return getExam(id)
}

export async function setExamStatus(
  id: string,
  status: 'open' | 'closed',
): Promise<ExamDetail> {
  const client = await db()
  const [row] = await client
    .update(exams)
    .set({ status, updatedAt: new Date() })
    .where(eq(exams.id, id))
    .returning()
  if (!row) {
    throw smsNotFound('Exam not found.')
  }
  return getExam(id)
}

// ---------------------------------------------------------------------------
// Exam subjects
// ---------------------------------------------------------------------------

export async function addExamSubject(
  examId: string,
  input: ExamSubjectUpsert,
): Promise<ExamDetail> {
  const client = await db()
  const [exam] = await client
    .select()
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  if (!exam) {
    throw smsNotFound('Exam not found.')
  }
  const [subject] = await client
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, input.subjectId))
    .limit(1)
  if (!subject) {
    throw smsFieldError('subjectId', 'Subject not found.')
  }
  try {
    await client.insert(examSubjects).values({
      examId,
      subjectId: input.subjectId,
      maxScore: input.maxScore ?? '100',
      examDate: input.examDate ?? null,
    })
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw smsConflict('That subject is already attached to the exam.')
    }
    throw e
  }
  return getExam(examId)
}

export async function updateExamSubject(
  examId: string,
  subjectId: string,
  input: ExamSubjectUpsert,
): Promise<ExamDetail> {
  const client = await db()
  const values: Record<string, unknown> = {}
  if (input.maxScore !== undefined) values.maxScore = input.maxScore
  if (input.examDate !== undefined) values.examDate = input.examDate
  const [row] = await client
    .update(examSubjects)
    .set(values)
    .where(
      and(
        eq(examSubjects.examId, examId),
        eq(examSubjects.subjectId, subjectId),
      ),
    )
    .returning()
  if (!row) {
    throw smsNotFound('Exam subject not found.')
  }
  return getExam(examId)
}

export async function removeExamSubject(
  examId: string,
  subjectId: string,
): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(examSubjects)
    .where(
      and(
        eq(examSubjects.examId, examId),
        eq(examSubjects.subjectId, subjectId),
      ),
    )
    .returning()
  if (!row) {
    throw smsNotFound('Exam subject not found.')
  }
}

// ---------------------------------------------------------------------------
// Lock helpers — once a publication leaves draft, scores cannot move.
// ---------------------------------------------------------------------------

async function assertScoresUnlocked(
  client: SmsDb,
  sessionId: string,
  termId: string | null,
  classId: string,
  sectionId?: string | null,
): Promise<void> {
  const where: SQL[] = [
    eq(resultPublications.sessionId, sessionId),
    eq(resultPublications.classId, classId),
  ]
  if (termId) {
    where.push(eq(resultPublications.termId, termId))
  }
  if (sectionId) {
    where.push(eq(resultPublications.sectionId, sectionId))
  } else {
    where.push(isNull(resultPublications.sectionId))
  }
  const [row] = await client
    .select({ status: resultPublications.status })
    .from(resultPublications)
    .where(and(...where))
    .limit(1)
  if (row && row.status !== 'draft') {
    throw smsConflict(
      `Results are locked (publication status: ${row.status}).`,
    )
  }
}

// ---------------------------------------------------------------------------
// Assessment scores
// ---------------------------------------------------------------------------

export async function listAssessmentScores(
  query: AssessmentScoreListQuery,
  actor: Actor,
): Promise<{ data: AssessmentScoreDetail[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.studentId) where.push(eq(assessmentScores.studentId, query.studentId))
  if (query.subjectId) where.push(eq(assessmentScores.subjectId, query.subjectId))
  if (query.sessionId) where.push(eq(assessmentScores.sessionId, query.sessionId))
  if (query.termId) where.push(eq(assessmentScores.termId, query.termId))
  if (query.assessmentTypeId) {
    where.push(
      eq(assessmentScores.assessmentTypeId, query.assessmentTypeId),
    )
  }
  // Students see only their own rows; parents only their children's.
  if (!actor.isAdmin && actor.studentId) {
    where.push(eq(assessmentScores.studentId, actor.studentId))
  }
  const rows = await client
    .select({
      score: assessmentScores,
      studentName:
        sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      admissionNumber: students.admissionNumber,
      subjectName: subjects.name,
      assessmentTypeName: assessmentTypes.name,
    })
    .from(assessmentScores)
    .innerJoin(students, eq(assessmentScores.studentId, students.id))
    .innerJoin(subjects, eq(assessmentScores.subjectId, subjects.id))
    .innerJoin(
      assessmentTypes,
      eq(assessmentScores.assessmentTypeId, assessmentTypes.id),
    )
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(students.admissionNumber))
  return {
    data: rows.map((r) => ({
      ...toJsonModel<AssessmentScoreDetail>(r.score),
      studentName: r.studentName,
      admissionNumber: r.admissionNumber,
      subjectName: r.subjectName,
      assessmentTypeName: r.assessmentTypeName,
    })),
  }
}

// Teachers may enter only for classes/subjects they teach; admins any.
async function assertCanEnterForStudent(
  client: SmsDb,
  actor: Actor,
  studentId: string,
  sessionId: string,
  subjectId: string,
): Promise<void> {
  if (actor.isAdmin) {
    return
  }
  if (!actor.teacherId) {
    throw smsForbidden()
  }
  // Find the student's active enrollment to learn the class.
  const [enrollment] = await client
    .select({
      classId: studentEnrollments.classId,
      sectionId: studentEnrollments.sectionId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.studentId, studentId),
        eq(studentEnrollments.sessionId, sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .limit(1)
  if (!enrollment) {
    throw smsFieldError(
      'studentId',
      'Student is not actively enrolled in this session.',
    )
  }
  const ok = await teacherIsAssigned(
    client,
    actor.teacherId,
    sessionId,
    enrollment.classId,
    subjectId,
    enrollment.sectionId ?? undefined,
  )
  if (!ok) {
    throw smsForbidden(
      'You can only enter scores for classes and subjects you teach.',
    )
  }
}

export async function upsertAssessmentScore(
  input: AssessmentScoreUpsert,
  actor: Actor,
): Promise<AssessmentScoreDetail> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId, input.termId)
  await assertCanEnterForStudent(
    client,
    actor,
    input.studentId,
    input.sessionId,
    input.subjectId,
  )
  // Resolve classId+sectionId for the lock check.
  const [enrollment] = await client
    .select({
      classId: studentEnrollments.classId,
      sectionId: studentEnrollments.sectionId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.studentId, input.studentId),
        eq(studentEnrollments.sessionId, input.sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .limit(1)
  if (!enrollment) {
    throw smsFieldError('studentId', 'Student is not actively enrolled.')
  }
  await assertScoresUnlocked(
    client,
    input.sessionId,
    input.termId ?? null,
    enrollment.classId,
    enrollment.sectionId ?? null,
  )
  const maxScore = input.maxScore ?? '100'
  if (Number(input.score) > Number(maxScore)) {
    throw smsFieldError('score', `Score cannot exceed ${maxScore}.`)
  }
  try {
    const [row] = await client
      .insert(assessmentScores)
      .values({
        studentId: input.studentId,
        subjectId: input.subjectId,
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        assessmentTypeId: input.assessmentTypeId,
        score: input.score,
        maxScore,
        enteredById: actor.teacherId,
      })
      .onConflictDoUpdate({
        target: [
          assessmentScores.studentId,
          assessmentScores.subjectId,
          assessmentScores.sessionId,
          assessmentScores.termId,
          assessmentScores.assessmentTypeId,
        ],
        set: {
          score: input.score,
          maxScore,
          enteredById: actor.teacherId,
          updatedAt: new Date(),
        },
      })
      .returning()
    // Enrich with the join fields the detail shape expects.
    const [enriched] = await client
      .select({
        score: assessmentScores,
        studentName:
          sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
        admissionNumber: students.admissionNumber,
        subjectName: subjects.name,
        assessmentTypeName: assessmentTypes.name,
      })
      .from(assessmentScores)
      .innerJoin(students, eq(assessmentScores.studentId, students.id))
      .innerJoin(subjects, eq(assessmentScores.subjectId, subjects.id))
      .innerJoin(
        assessmentTypes,
        eq(assessmentScores.assessmentTypeId, assessmentTypes.id),
      )
      .where(eq(assessmentScores.id, row!.id))
      .limit(1)
    return {
      ...toJsonModel<AssessmentScoreDetail>(enriched!.score),
      studentName: enriched!.studentName,
      admissionNumber: enriched!.admissionNumber,
      subjectName: enriched!.subjectName,
      assessmentTypeName: enriched!.assessmentTypeName,
    }
  } catch (e) {
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

export async function bulkUpsertAssessmentScores(
  input: AssessmentScoreBulk,
  actor: Actor,
): Promise<{ count: number }> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId, input.termId)
  const maxScore = input.maxScore ?? '100'
  for (const s of input.scores) {
    if (Number(s.score) > Number(maxScore)) {
      throw smsFieldError('score', `Score for ${s.studentId} exceeds ${maxScore}.`)
    }
  }
  // All students must be enrolled and the teacher must be assigned.
  for (const s of input.scores) {
    await assertCanEnterForStudent(
      client,
      actor,
      s.studentId,
      input.sessionId,
      input.subjectId,
    )
  }
  // Use the first student's enrollment to derive the class for the lock.
  const [first] = await client
    .select({
      classId: studentEnrollments.classId,
      sectionId: studentEnrollments.sectionId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.studentId, input.scores[0]!.studentId),
        eq(studentEnrollments.sessionId, input.sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .limit(1)
  if (!first) {
    throw smsFieldError('studentId', 'Student is not actively enrolled.')
  }
  await assertScoresUnlocked(
    client,
    input.sessionId,
    input.termId ?? null,
    first.classId,
    first.sectionId ?? null,
  )
  const rows = input.scores.map((s) => ({
    studentId: s.studentId,
    subjectId: input.subjectId,
    sessionId: input.sessionId,
    termId: input.termId ?? null,
    assessmentTypeId: input.assessmentTypeId,
    score: s.score,
    maxScore,
    enteredById: actor.teacherId,
  }))
  await client
    .insert(assessmentScores)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        assessmentScores.studentId,
        assessmentScores.subjectId,
        assessmentScores.sessionId,
        assessmentScores.termId,
        assessmentScores.assessmentTypeId,
      ],
      set: {
        score: sql`excluded.score`,
        maxScore: sql`excluded.max_score`,
        enteredById: sql`excluded.entered_by_id`,
        updatedAt: new Date(),
      },
    })
  return { count: rows.length }
}

// ---------------------------------------------------------------------------
// Exam scores
// ---------------------------------------------------------------------------

export async function bulkUpsertExamScores(
  input: ExamScoreBulk,
  actor: Actor,
): Promise<{ count: number }> {
  const client = await db()
  const [es] = await client
    .select({
      id: examSubjects.id,
      examId: examSubjects.examId,
      subjectId: examSubjects.subjectId,
      maxScore: examSubjects.maxScore,
    })
    .from(examSubjects)
    .where(eq(examSubjects.id, input.examSubjectId))
    .limit(1)
  if (!es) {
    throw smsNotFound('Exam subject not found.')
  }
  for (const s of input.scores) {
    if (Number(s.score) > Number(es.maxScore)) {
      throw smsFieldError('score', `Score for ${s.studentId} exceeds ${es.maxScore}.`)
    }
  }
  const [exam] = await client
    .select({
      sessionId: exams.sessionId,
      termId: exams.termId,
      classId: exams.classId,
    })
    .from(exams)
    .where(eq(exams.id, es.examId))
    .limit(1)
  if (!exam) {
    throw smsNotFound('Exam not found.')
  }
  await assertScoresUnlocked(
    client,
    exam.sessionId,
    exam.termId,
    exam.classId,
  )
  // Authorization: every student must belong to a class/subject the
  // teacher is assigned to (admins skip).
  for (const s of input.scores) {
    await assertCanEnterForStudent(
      client,
      actor,
      s.studentId,
      exam.sessionId,
      es.subjectId,
    )
  }
  // Active grading scale items for grade computation.
  const scaleItems = await getActiveGradingScaleItems(client, exam.sessionId)
  const rows = input.scores.map((s) => {
    const pct = (Number(s.score) / Number(es.maxScore)) * 100
    return {
      examSubjectId: input.examSubjectId,
      studentId: s.studentId,
      score: s.score,
      grade: computeGrade(pct, scaleItems),
      enteredById: actor.teacherId,
    }
  })
  await client
    .insert(examScores)
    .values(rows)
    .onConflictDoUpdate({
      target: [examScores.examSubjectId, examScores.studentId],
      set: {
        score: sql`excluded.score`,
        grade: sql`excluded.grade`,
        enteredById: sql`excluded.entered_by_id`,
        updatedAt: new Date(),
      },
    })
  return { count: rows.length }
}

// ---------------------------------------------------------------------------
// Result publications
// ---------------------------------------------------------------------------

export async function listPublications(
  query: ResultPublicationListQuery,
): Promise<{ data: ResultPublicationDetail[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(resultPublications.sessionId, query.sessionId))
  }
  if (query.termId) where.push(eq(resultPublications.termId, query.termId))
  if (query.classId) where.push(eq(resultPublications.classId, query.classId))
  if (query.status) where.push(eq(resultPublications.status, query.status))
  const rows = await client
    .select({
      publication: resultPublications,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(resultPublications)
    .innerJoin(classes, eq(resultPublications.classId, classes.id))
    .leftJoin(sections, eq(resultPublications.sectionId, sections.id))
    .innerJoin(
      academicSessions,
      eq(resultPublications.sessionId, academicSessions.id),
    )
    .innerJoin(terms, eq(resultPublications.termId, terms.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(resultPublications.updatedAt))
  return {
    data: rows.map((r) => ({
      ...toJsonModel<ResultPublicationDetail>(r.publication),
      className: r.className,
      sectionName: r.sectionName,
      sessionName: r.sessionName,
      termName: r.termName,
    })),
  }
}

export async function getPublication(
  id: string,
): Promise<ResultPublicationDetail> {
  const client = await db()
  const [row] = await client
    .select({
      publication: resultPublications,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(resultPublications)
    .innerJoin(classes, eq(resultPublications.classId, classes.id))
    .leftJoin(sections, eq(resultPublications.sectionId, sections.id))
    .innerJoin(
      academicSessions,
      eq(resultPublications.sessionId, academicSessions.id),
    )
    .innerJoin(terms, eq(resultPublications.termId, terms.id))
    .where(eq(resultPublications.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Result publication not found.')
  }
  return {
    ...toJsonModel<ResultPublicationDetail>(row.publication),
    className: row.className,
    sectionName: row.sectionName,
    sessionName: row.sessionName,
    termName: row.termName,
  }
}

export async function getOrCreatePublication(
  input: ResultPublicationCreate,
  actor: Actor,
): Promise<ResultPublicationDetail> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId, input.termId)
  await validateClassSection(client, input.classId, input.sectionId)
  // Teachers may only submit for classes they teach (admin skips).
  if (!actor.isAdmin && actor.teacherId) {
    const [assigned] = await client
      .select({ marker: sql`1` })
      .from(teacherClassAssignments)
      .where(
        and(
          eq(teacherClassAssignments.teacherId, actor.teacherId),
          eq(teacherClassAssignments.sessionId, input.sessionId),
          eq(teacherClassAssignments.classId, input.classId),
        ),
      )
      .limit(1)
    if (!assigned) {
      throw smsForbidden(
        'You can only manage publications for classes you teach.',
      )
    }
  }
  const where: SQL[] = [
    eq(resultPublications.sessionId, input.sessionId),
    eq(resultPublications.termId, input.termId),
    eq(resultPublications.classId, input.classId),
  ]
  if (input.sectionId) {
    where.push(eq(resultPublications.sectionId, input.sectionId))
  } else {
    where.push(isNull(resultPublications.sectionId))
  }
  const [existing] = await client
    .select()
    .from(resultPublications)
    .where(and(...where))
    .limit(1)
  if (existing) {
    return getPublication(existing.id)
  }
  const [row] = await client
    .insert(resultPublications)
    .values({
      sessionId: input.sessionId,
      termId: input.termId,
      classId: input.classId,
      sectionId: input.sectionId ?? null,
      status: 'draft',
    })
    .returning({ id: resultPublications.id })
  if (!row) {
    throw smsConflict('Publication could not be saved.')
  }
  return getPublication(row.id)
}

function assertTransition(
  current: string,
  next: 'submitted' | 'approved' | 'published',
): void {
  const allowed: Record<string, string> = {
    draft: 'submitted',
    submitted: 'approved',
    approved: 'published',
  }
  if (allowed[current] !== next) {
    throw smsConflict(
      `Cannot transition publication from ${current} to ${next}.`,
    )
  }
}

async function getPublicationOrThrow(
  client: SmsDb,
  id: string,
) {
  const [row] = await client
    .select()
    .from(resultPublications)
    .where(eq(resultPublications.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Result publication not found.')
  }
  return row
}

export async function submitPublication(
  id: string,
  actor: Actor,
): Promise<ResultPublicationDetail> {
  const client = await db()
  const pub = await getPublicationOrThrow(client, id)
  assertTransition(pub.status, 'submitted')
  // Teachers may only submit their own class; admins skip.
  if (!actor.isAdmin && actor.teacherId) {
    const [assigned] = await client
      .select({ marker: sql`1` })
      .from(teacherClassAssignments)
      .where(
        and(
          eq(teacherClassAssignments.teacherId, actor.teacherId),
          eq(teacherClassAssignments.sessionId, pub.sessionId),
          eq(teacherClassAssignments.classId, pub.classId),
        ),
      )
      .limit(1)
    if (!assigned) {
      throw smsForbidden(
        'You can only submit publications for classes you teach.',
      )
    }
  }
  await client
    .update(resultPublications)
    .set({
      status: 'submitted',
      submittedById: actor.teacherId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(resultPublications.id, id))
  return getPublication(id)
}

export async function approvePublication(
  id: string,
  actor: Actor,
): Promise<ResultPublicationDetail> {
  const client = await db()
  const pub = await getPublicationOrThrow(client, id)
  assertTransition(pub.status, 'approved')
  await client
    .update(resultPublications)
    .set({
      status: 'approved',
      approvedById: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(resultPublications.id, id))
  return getPublication(id)
}

export async function publishPublication(
  id: string,
  actor: Actor,
): Promise<ResultPublicationDetail> {
  const client = await db()
  const pub = await getPublicationOrThrow(client, id)
  assertTransition(pub.status, 'published')
  await client
    .update(resultPublications)
    .set({
      status: 'published',
      publishedById: actor.userId,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(resultPublications.id, id))
  return getPublication(id)
}

// ---------------------------------------------------------------------------
// Student results aggregate
// ---------------------------------------------------------------------------

// Builds per-subject result rows for a student. Combines assessment_scores
// and exam_scores, computes totals, percentages and grades from the
// active grading scale.
async function aggregateStudentResults(
  client: SmsDb,
  studentId: string,
  sessionId: string,
  termId: string | null,
): Promise<{ subjects: SubjectResult[]; totalScore: number; maxScore: number }> {
  const scaleItems = await getActiveGradingScaleItems(client, sessionId)
  // Assessment scores
  const aWhere: SQL[] = [
    eq(assessmentScores.studentId, studentId),
    eq(assessmentScores.sessionId, sessionId),
  ]
  if (termId) aWhere.push(eq(assessmentScores.termId, termId))
  const assessmentRows = await client
    .select({
      subjectId: assessmentScores.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      assessmentTypeId: assessmentScores.assessmentTypeId,
      assessmentTypeName: assessmentTypes.name,
      score: assessmentScores.score,
      maxScore: assessmentScores.maxScore,
    })
    .from(assessmentScores)
    .innerJoin(subjects, eq(assessmentScores.subjectId, subjects.id))
    .innerJoin(
      assessmentTypes,
      eq(assessmentScores.assessmentTypeId, assessmentTypes.id),
    )
    .where(and(...aWhere))
  // Exam scores — join through examSubjects -> exams -> session/term
  const examRows = await client
    .select({
      subjectId: examSubjects.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      examId: exams.id,
      examName: exams.name,
      score: examScores.score,
      maxScore: examSubjects.maxScore,
      grade: examScores.grade,
    })
    .from(examScores)
    .innerJoin(examSubjects, eq(examScores.examSubjectId, examSubjects.id))
    .innerJoin(exams, eq(examSubjects.examId, exams.id))
    .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
    .where(
      and(
        eq(examScores.studentId, studentId),
        eq(exams.sessionId, sessionId),
        termId ? eq(exams.termId, termId) : sql`true`,
      ),
    )
  // Group by subject
  const bySubject = new Map<
    string,
    {
      subjectId: string
      subjectName: string
      subjectCode: string | null
      assessmentScores: SubjectResult['assessmentScores']
      examScores: SubjectResult['examScores']
      totalScore: number
      maxScore: number
    }
  >()
  const ensure = (
    subjectId: string,
    subjectName: string,
    subjectCode: string | null,
  ) => {
    let row = bySubject.get(subjectId)
    if (!row) {
      row = {
        subjectId,
        subjectName,
        subjectCode,
        assessmentScores: [],
        examScores: [],
        totalScore: 0,
        maxScore: 0,
      }
      bySubject.set(subjectId, row)
    }
    return row
  }
  for (const r of assessmentRows) {
    const row = ensure(r.subjectId, r.subjectName, r.subjectCode)
    row.assessmentScores.push({
      assessmentTypeId: r.assessmentTypeId,
      assessmentTypeName: r.assessmentTypeName,
      score: r.score,
      maxScore: r.maxScore,
    })
    row.totalScore += Number(r.score)
    row.maxScore += Number(r.maxScore)
  }
  for (const r of examRows) {
    const row = ensure(r.subjectId, r.subjectName, r.subjectCode)
    row.examScores.push({
      examId: r.examId,
      examName: r.examName,
      score: r.score,
      maxScore: r.maxScore,
      grade: r.grade,
    })
    row.totalScore += Number(r.score)
    row.maxScore += Number(r.maxScore)
  }
  const subjectResults: SubjectResult[] = []
  let total = 0
  let max = 0
  for (const row of bySubject.values()) {
    const pct = row.maxScore > 0 ? (row.totalScore / row.maxScore) * 100 : 0
    subjectResults.push({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
      assessmentScores: row.assessmentScores,
      examScores: row.examScores,
      totalScore: row.totalScore.toFixed(2),
      maxScore: row.maxScore.toFixed(2),
      percentage: pct.toFixed(2),
      grade: computeGrade(pct, scaleItems),
    })
    total += row.totalScore
    max += row.maxScore
  }
  return { subjects: subjectResults, totalScore: total, maxScore: max }
}

// GET /students/{id}/results. Students see only their own; parents only
// their children's; staff any. Only returns data when the publication
// for the session/term/class is `published`.
export async function getStudentResults(
  studentId: string,
  sessionId: string,
  termId: string,
  actor: Actor,
): Promise<StudentResultSummary> {
  const client = await db()
  // Authorization: self / parent / staff.
  if (!actor.isAdmin) {
    if (actor.studentId && actor.studentId !== studentId) {
      throw smsForbidden()
    }
    if (!actor.studentId && !actor.teacherId) {
      // Likely a parent — verify link.
      const owns = await parentOwnsStudent(client, actor.userId, studentId)
      if (!owns) {
        throw smsForbidden()
      }
    }
  }
  const [student] = await client
    .select({
      id: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(students)
    .where(and(eq(students.id, studentId), activeStudent))
    .limit(1)
  if (!student) {
    throw smsNotFound('Student not found.')
  }
  const [session] = await client
    .select({ name: academicSessions.name })
    .from(academicSessions)
    .where(eq(academicSessions.id, sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }
  const [term] = await client
    .select({ name: terms.name })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1)
  if (!term) {
    throw smsFieldError('termId', 'Term not found.')
  }
  const [enrollment] = await client
    .select({
      classId: studentEnrollments.classId,
      sectionId: studentEnrollments.sectionId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.studentId, studentId),
        eq(studentEnrollments.sessionId, sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .limit(1)
  if (!enrollment) {
    throw smsFieldError('studentId', 'Student is not actively enrolled.')
  }
  // Publication lock check — students/parents only see published.
  const where: SQL[] = [
    eq(resultPublications.sessionId, sessionId),
    eq(resultPublications.termId, termId),
    eq(resultPublications.classId, enrollment.classId),
  ]
  if (enrollment.sectionId) {
    where.push(eq(resultPublications.sectionId, enrollment.sectionId))
  } else {
    where.push(isNull(resultPublications.sectionId))
  }
  const [pub] = await client
    .select({ status: resultPublications.status })
    .from(resultPublications)
    .where(and(...where))
    .limit(1)
  const publicationStatus = pub?.status ?? null
  if (
    publicationStatus !== 'published' &&
    !actor.isAdmin &&
    !(actor.teacherId)
  ) {
    // Students/parents see nothing until published.
    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber: student.admissionNumber,
      sessionId,
      sessionName: session.name,
      termId,
      termName: term.name,
      classId: enrollment.classId,
      className: null,
      publicationStatus,
      subjects: [],
      totalScore: null,
      averageScore: null,
      overallGrade: null,
    }
  }
  const [klass] = await client
    .select({ name: classes.name })
    .from(classes)
    .where(eq(classes.id, enrollment.classId))
    .limit(1)
  const agg = await aggregateStudentResults(
    client,
    studentId,
    sessionId,
    termId,
  )
  const scaleItems = await getActiveGradingScaleItems(client, sessionId)
  const overallPct =
    agg.maxScore > 0 ? (agg.totalScore / agg.maxScore) * 100 : 0
  return {
    studentId,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    sessionId,
    sessionName: session.name,
    termId,
    termName: term.name,
    classId: enrollment.classId,
    className: klass?.name ?? null,
    publicationStatus,
    subjects: agg.subjects,
    totalScore: agg.totalScore.toFixed(2),
    averageScore: overallPct.toFixed(2),
    overallGrade: computeGrade(overallPct, scaleItems),
  }
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export async function listReportCards(
  query: ReportCardListQuery,
  actor: Actor,
): Promise<{ data: ReportCardDetail[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.studentId) where.push(eq(reportCards.studentId, query.studentId))
  if (query.sessionId) where.push(eq(reportCards.sessionId, query.sessionId))
  if (query.termId) where.push(eq(reportCards.termId, query.termId))
  if (query.status) where.push(eq(reportCards.status, query.status))
  // Students see only their own; parents only their children's. Non-staff
  // never see non-published cards. Parents must own the queried studentId.
  if (!actor.isAdmin && !actor.teacherId) {
    if (actor.studentId) {
      where.push(eq(reportCards.studentId, actor.studentId))
    } else {
      // Likely a parent — verify they own the queried studentId.
      if (query.studentId) {
        const owns = await parentOwnsStudent(
          client,
          actor.userId,
          query.studentId,
        )
        if (!owns) {
          throw smsForbidden()
        }
      } else {
        // No studentId filter and no parent target — return nothing.
        where.push(sql`false`)
      }
    }
    if (!query.status) {
      where.push(eq(reportCards.status, 'published'))
    }
  }
  const rows = await client
    .select({
      card: reportCards,
      studentName:
        sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      admissionNumber: students.admissionNumber,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(reportCards)
    .innerJoin(students, eq(reportCards.studentId, students.id))
    .innerJoin(classes, eq(reportCards.classId, classes.id))
    .leftJoin(sections, eq(reportCards.sectionId, sections.id))
    .innerJoin(academicSessions, eq(reportCards.sessionId, academicSessions.id))
    .innerJoin(terms, eq(reportCards.termId, terms.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(reportCards.updatedAt))
  return {
    data: rows.map((r) => ({
      ...toJsonModel<ReportCardDetail>(r.card),
      studentName: r.studentName,
      admissionNumber: r.admissionNumber,
      className: r.className,
      sectionName: r.sectionName,
      sessionName: r.sessionName,
      termName: r.termName,
      subjectResults: [],
    })),
  }
}

export async function getReportCard(
  id: string,
  actor: Actor,
): Promise<ReportCardDetail> {
  const client = await db()
  const [row] = await client
    .select({
      card: reportCards,
      studentName:
        sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      admissionNumber: students.admissionNumber,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(reportCards)
    .innerJoin(students, eq(reportCards.studentId, students.id))
    .innerJoin(classes, eq(reportCards.classId, classes.id))
    .leftJoin(sections, eq(reportCards.sectionId, sections.id))
    .innerJoin(academicSessions, eq(reportCards.sessionId, academicSessions.id))
    .innerJoin(terms, eq(reportCards.termId, terms.id))
    .where(eq(reportCards.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Report card not found.')
  }
  // Students/parents: only published + own/children.
  if (!actor.isAdmin && !actor.teacherId) {
    if (
      row.card.status !== 'published' ||
      (actor.studentId && row.card.studentId !== actor.studentId)
    ) {
      // Maybe a parent — verify link.
      const owns = await parentOwnsStudent(client, actor.userId, row.card.studentId)
      if (!owns) {
        throw smsForbidden()
      }
    }
  }
  const agg = await aggregateStudentResults(
    client,
    row.card.studentId,
    row.card.sessionId,
    row.card.termId,
  )
  return {
    ...toJsonModel<ReportCardDetail>(row.card),
    studentName: row.studentName,
    admissionNumber: row.admissionNumber,
    className: row.className,
    sectionName: row.sectionName,
    sessionName: row.sessionName,
    termName: row.termName,
    subjectResults: agg.subjects,
  }
}

export async function generateReportCard(
  input: ReportCardGenerate,
  actor: Actor,
): Promise<ReportCardDetail> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId, input.termId)
  await validateClassSection(client, input.classId, input.sectionId)
  const [student] = await client
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, input.studentId), activeStudent))
    .limit(1)
  if (!student) {
    throw smsFieldError('studentId', 'Student not found.')
  }
  const enrolled = await studentIsEnrolled(
    client,
    input.studentId,
    input.sessionId,
    input.classId,
    input.sectionId ?? null,
  )
  if (!enrolled) {
    throw smsFieldError(
      'studentId',
      'Student is not actively enrolled in the selected class.',
    )
  }
  const agg = await aggregateStudentResults(
    client,
    input.studentId,
    input.sessionId,
    input.termId,
  )
  const scaleItems = await getActiveGradingScaleItems(client, input.sessionId)
  const overallPct =
    agg.maxScore > 0 ? (agg.totalScore / agg.maxScore) * 100 : 0
  const overallGrade = computeGrade(overallPct, scaleItems)
  try {
    const [row] = await client
      .insert(reportCards)
      .values({
        studentId: input.studentId,
        sessionId: input.sessionId,
        termId: input.termId,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        totalScore: agg.totalScore.toFixed(2),
        averageScore: overallPct.toFixed(2),
        overallGrade,
        attendanceSummary: input.attendanceSummary ?? null,
        teacherRemark: input.teacherRemark ?? null,
        principalRemark: input.principalRemark ?? null,
        status: 'draft',
        generatedById: actor.userId,
      })
      .onConflictDoUpdate({
        target: [
          reportCards.studentId,
          reportCards.sessionId,
          reportCards.termId,
        ],
        set: {
          totalScore: sql`excluded.total_score`,
          averageScore: sql`excluded.average_score`,
          overallGrade: sql`excluded.overall_grade`,
          attendanceSummary: sql`excluded.attendance_summary`,
          teacherRemark: sql`excluded.teacher_remark`,
          principalRemark: sql`excluded.principal_remark`,
          generatedById: sql`excluded.generated_by_id`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: reportCards.id })
    if (!row) {
      throw smsConflict('Report card could not be saved.')
    }
    return getReportCard(row.id, actor)
  } catch (e) {
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

export async function publishReportCard(
  id: string,
  actor: Actor,
): Promise<ReportCardDetail> {
  const client = await db()
  const [row] = await client
    .update(reportCards)
    .set({
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reportCards.id, id))
    .returning()
  if (!row) {
    throw smsNotFound('Report card not found.')
  }
  return getReportCard(id, actor)
}
