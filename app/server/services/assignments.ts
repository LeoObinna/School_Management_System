/**
 * Assignment, attachment and submission services (README §17, Phase 6).
 *
 * File bytes live in R2 (see storage.ts); these functions own the
 * PostgreSQL metadata and all authorization-sensitive rules. Staff
 * (users holding assignments.create) manage work; students interact
 * only with published assignments for classes they are enrolled in and
 * only with their own submission.
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
  assignmentAttachments,
  assignments,
  assignmentSubmissions,
  classes,
  sections,
  studentEnrollments,
  students,
  subjects,
  teachers,
  terms,
} from '../../database/schema'
import type {
  AssignmentCreate,
  AssignmentListQuery,
  AssignmentUpdate,
  MyAssignmentListQuery,
  SubmissionFileMeta,
  SubmissionGrade,
  SubmissionListQuery,
  SubmissionUpsert,
} from '../../shared/schemas'
import type {
  Assignment,
  AssignmentAttachment,
  AssignmentDetail,
  AssignmentListItem,
  AssignmentSubmission,
  SubmissionDetail,
} from '../../shared/types'
import type { AuthContext } from '../utils/auth/context'
import {
  isPgForeignKeyViolation,
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
const activeTeacher = isNull(teachers.deletedAt)

// Request actor, resolved from the authenticated login.
export interface Actor {
  userId: string
  isStaff: boolean
  teacherId: string | null
  studentId: string | null
}

export async function getActor(
  auth: AuthContext,
  staffPermission = 'assignments.create',
): Promise<Actor> {
  const client = await db()
  const [teacherRow, studentRow] = await Promise.all([
    client
      .select({ id: teachers.id })
      .from(teachers)
      .where(and(eq(teachers.userId, auth.user.id), activeTeacher))
      .limit(1),
    client
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.userId, auth.user.id), activeStudent))
      .limit(1),
  ])
  return {
    userId: auth.user.id,
    isStaff: auth.permissions.includes(staffPermission),
    teacherId: teacherRow[0]?.id ?? null,
    studentId: studentRow[0]?.id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Reference validation
// ---------------------------------------------------------------------------

interface AssignmentRefs {
  sessionId: string
  termId?: string | null
  classId: string
  sectionId?: string | null
  subjectId: string
}

async function validateRefs(
  client: SmsDb,
  refs: AssignmentRefs,
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
    if (!section || section.classId !== refs.classId) {
      throw smsFieldError(
        'sectionId',
        'Section not found in the selected class.',
      )
    }
  }
  const [subject] = await client
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, refs.subjectId))
    .limit(1)
  if (!subject) {
    throw smsFieldError('subjectId', 'Subject not found.')
  }
}

// True when an active enrollment places the student in the assignment's
// class (and section, when the assignment targets one).
async function studentIsEnrolled(
  client: SmsDb,
  studentId: string,
  assignment: {
    sessionId: string
    classId: string
    sectionId: string | null
  },
): Promise<boolean> {
  const where: SQL[] = [
    eq(studentEnrollments.studentId, studentId),
    eq(studentEnrollments.sessionId, assignment.sessionId),
    eq(studentEnrollments.classId, assignment.classId),
    eq(studentEnrollments.status, 'active'),
  ]
  if (assignment.sectionId) {
    where.push(
      or(
        eq(studentEnrollments.sectionId, assignment.sectionId),
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

// Teachers may only modify their own assignments; admins (no teacher
// profile link) may modify any.
function assertCanManage(
  assignment: { teacherId: string },
  actor: Actor,
): void {
  if (!actor.isStaff) {
    throw smsForbidden()
  }
  if (actor.teacherId && assignment.teacherId !== actor.teacherId) {
    throw smsForbidden('You can only modify your own assignments.')
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const nameJoinFields = {
  className: classes.name,
  sectionName: sections.name,
  subjectName: subjects.name,
  teacherName: sql<string>`trim(concat(${teachers.firstName}, ' ', ${teachers.lastName}))`,
  sessionName: academicSessions.name,
  termName: terms.name,
}

function assignmentBaseQuery(client: SmsDb) {
  return client
    .select({
      ...nameJoinFields,
      assignment: assignments,
    })
    .from(assignments)
    .innerJoin(classes, eq(assignments.classId, classes.id))
    .leftJoin(sections, eq(assignments.sectionId, sections.id))
    .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
    .innerJoin(teachers, eq(assignments.teacherId, teachers.id))
    .innerJoin(
      academicSessions,
      eq(assignments.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(assignments.termId, terms.id))
}

// Flattens the nested `assignment` object into a detail row.
function flattenAssignment(row: {
  assignment: typeof assignments.$inferSelect
  className: string
  sectionName: string | null
  subjectName: string
  teacherName: string
  sessionName: string
  termName: string | null
}): Record<string, unknown> {
  return { ...row.assignment, className: row.className, sectionName: row.sectionName, subjectName: row.subjectName, teacherName: row.teacherName, sessionName: row.sessionName, termName: row.termName }
}

function toDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined
  }
  return value === null ? null : new Date(value).toISOString()
}

export async function listAssignments(
  query: AssignmentListQuery,
  actor: Actor,
): Promise<{ data: AssignmentListItem[] }> {
  const client = await db()
  const where: SQL[] = []

  if (query.sessionId) {
    where.push(eq(assignments.sessionId, query.sessionId))
  }
  if (query.termId) {
    where.push(eq(assignments.termId, query.termId))
  }
  if (query.classId) {
    where.push(eq(assignments.classId, query.classId))
  }
  if (query.sectionId) {
    where.push(eq(assignments.sectionId, query.sectionId))
  }
  if (query.subjectId) {
    where.push(eq(assignments.subjectId, query.subjectId))
  }
  if (query.teacherId) {
    where.push(eq(assignments.teacherId, query.teacherId))
  }
  if (query.status) {
    where.push(eq(assignments.status, query.status))
  }

  if (!actor.isStaff) {
    if (!actor.studentId) {
      return { data: [] }
    }
    where.push(eq(assignments.status, 'published'))
    // Restrict to classes/sections the student is actively enrolled in.
    where.push(
      sql`exists (
        select 1 from ${studentEnrollments}
        where ${studentEnrollments.studentId} = ${actor.studentId}
          and ${studentEnrollments.status} = 'active'
          and ${studentEnrollments.sessionId} = ${assignments.sessionId}
          and ${studentEnrollments.classId} = ${assignments.classId}
          and (
            ${assignments.sectionId} is null
            or ${studentEnrollments.sectionId} is null
            or ${studentEnrollments.sectionId} = ${assignments.sectionId}
          )
      )`,
    )
  }

  const rows = await assignmentBaseQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(assignments.createdAt))

  let mySubmissionByAssignment = new Map<string, unknown>()
  if (!actor.isStaff && actor.studentId) {
    const ids = rows.map((r) => r.assignment.id)
    if (ids.length > 0) {
      const subs = await client
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.studentId, actor.studentId),
            inArray(assignmentSubmissions.assignmentId, ids),
          ),
        )
      mySubmissionByAssignment = new Map(
        subs.map((s) => [s.assignmentId, s]),
      )
    }
  }

  const data = rows.map((row) =>
    toJsonModel<AssignmentListItem>({
      ...flattenAssignment(row),
      mySubmission:
        (mySubmissionByAssignment.get(row.assignment.id) as never) ?? null,
    }),
  )
  return { data }
}

export async function getAssignmentForActor(
  id: string,
  actor: Actor,
): Promise<AssignmentDetail> {
  const client = await db()
  const [row] = await assignmentBaseQuery(client)
    .where(eq(assignments.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Assignment not found.')
  }
  if (
    !actor.isStaff &&
    (row.assignment.status !== 'published' ||
      !actor.studentId ||
      !(await studentIsEnrolled(client, actor.studentId, row.assignment)))
  ) {
    throw smsNotFound('Assignment not found.')
  }
  const attachmentRows = await client
    .select()
    .from(assignmentAttachments)
    .where(eq(assignmentAttachments.assignmentId, id))
    .orderBy(asc(assignmentAttachments.fileName))
  return toJsonModel<AssignmentDetail>({
    ...flattenAssignment(row),
    attachments: toJsonList<AssignmentAttachment>(attachmentRows),
  })
}

export async function createAssignment(
  input: AssignmentCreate,
  actor: Actor,
): Promise<AssignmentDetail> {
  const client = await db()
  await validateRefs(client, input)
  if (!actor.teacherId) {
    throw smsFieldError(
      'teacherId',
      'Assignments must be created by a linked teacher account.',
    )
  }

  const status = input.status ?? 'draft'
  let publishedAt = toDate(input.publishedAt)
  if (status === 'published' && publishedAt === undefined) {
    publishedAt = new Date().toISOString()
  }

  try {
    const [created] = await client
      .insert(assignments)
      .values({
        teacherId: actor.teacherId,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        subjectId: input.subjectId,
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        title: input.title,
        instructions: input.instructions ?? null,
        maxScore: input.maxScore ?? 100,
        dueDate: toDate(input.dueDate) ?? null,
        status,
        publishedAt: publishedAt ?? null,
      })
      .returning({ id: assignments.id })
    if (!created) {
      throw smsConflict('Assignment could not be saved.')
    }
    return getAssignmentForActor(created.id, actor)
  } catch (e) {
    if (isPgForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced record no longer exists.')
    }
    throw e
  }
}

export async function updateAssignment(
  id: string,
  input: AssignmentUpdate,
  actor: Actor,
): Promise<AssignmentDetail> {
  const client = await db()
  const existing = await getRawAssignmentOrThrow(client, id)
  assertCanManage(existing, actor)

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
  }
  await validateRefs(client, merged)

  const values: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (input.title !== undefined) values.title = input.title
  if (input.instructions !== undefined) {
    values.instructions = input.instructions
  }
  if (input.maxScore !== undefined) values.maxScore = input.maxScore
  if (input.dueDate !== undefined) {
    values.dueDate = toDate(input.dueDate)
  }
  if (input.classId !== undefined) values.classId = input.classId
  if (input.sectionId !== undefined) values.sectionId = input.sectionId
  if (input.subjectId !== undefined) values.subjectId = input.subjectId
  if (input.sessionId !== undefined) values.sessionId = input.sessionId
  if (input.termId !== undefined) values.termId = input.termId

  if (input.status !== undefined) {
    values.status = input.status
    const wasPublished =
      existing.status === 'published' || existing.publishedAt !== null
    if (input.status === 'published' && !wasPublished) {
      values.publishedAt = new Date().toISOString()
    }
    if (input.status === 'draft') {
      values.publishedAt = null
    }
  }
  if (input.publishedAt !== undefined) {
    values.publishedAt = toDate(input.publishedAt)
  }

  await client
    .update(assignments)
    .set(values)
    .where(eq(assignments.id, id))
  return getAssignmentForActor(id, actor)
}

/** Deletes metadata and returns R2 keys the route must purge. */
export async function deleteAssignment(
  id: string,
  actor: Actor,
): Promise<{ objectKeys: string[] }> {
  const client = await db()
  const existing = await getRawAssignmentOrThrow(client, id)
  assertCanManage(existing, actor)

  const attachmentKeys = await client
    .select({ objectKey: assignmentAttachments.objectKey })
    .from(assignmentAttachments)
    .where(eq(assignmentAttachments.assignmentId, id))
  const submissionKeys = await client
    .select({ objectKey: assignmentSubmissions.objectKey })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, id),
        sql`${assignmentSubmissions.objectKey} is not null`,
      ),
    )

  await client.delete(assignments).where(eq(assignments.id, id))
  return {
    objectKeys: [
      ...attachmentKeys.map((r) => r.objectKey),
      ...submissionKeys.map((r) => r.objectKey).filter((k): k is string => !!k),
    ],
  }
}

async function getRawAssignmentOrThrow(
  client: SmsDb,
  id: string,
): Promise<Assignment> {
  const [row] = await client
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Assignment not found.')
  }
  return toJsonModel<Assignment>(row)
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function addAttachment(
  assignmentId: string,
  file: SubmissionFileMeta,
  actor: Actor,
): Promise<AssignmentAttachment> {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  assertCanManage(assignment, actor)
  const [row] = await client
    .insert(assignmentAttachments)
    .values({
      assignmentId,
      objectKey: file.objectKey,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: actor.teacherId,
    })
    .returning()
  return toJsonModel<AssignmentAttachment>(row)
}

export interface AttachmentAccess {
  attachment: AssignmentAttachment
  objectKey: string
  assignment: {
    id: string
    status: string
    sessionId: string
    classId: string
    sectionId: string | null
  }
}

export async function getAttachmentForActor(
  assignmentId: string,
  attachmentId: string,
  actor: Actor,
): Promise<AttachmentAccess> {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  const [row] = await client
    .select()
    .from(assignmentAttachments)
    .where(
      and(
        eq(assignmentAttachments.id, attachmentId),
        eq(assignmentAttachments.assignmentId, assignmentId),
      ),
    )
    .limit(1)
  if (!row) {
    throw smsNotFound('Attachment not found.')
  }
  if (!actor.isStaff) {
    if (assignment.status !== 'published' || !actor.studentId) {
      throw smsNotFound('Attachment not found.')
    }
    if (!(await studentIsEnrolled(client, actor.studentId, assignment))) {
      throw smsNotFound('Attachment not found.')
    }
  }
  return {
    attachment: toJsonModel<AssignmentAttachment>(row),
    objectKey: row.objectKey,
    assignment,
  }
}

/** Deletes metadata; caller purges the returned R2 object key. */
export async function deleteAttachment(
  assignmentId: string,
  attachmentId: string,
  actor: Actor,
): Promise<string> {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  assertCanManage(assignment, actor)
  const [row] = await client
    .delete(assignmentAttachments)
    .where(
      and(
        eq(assignmentAttachments.id, attachmentId),
        eq(assignmentAttachments.assignmentId, assignmentId),
      ),
    )
    .returning({ objectKey: assignmentAttachments.objectKey })
  if (!row) {
    throw smsNotFound('Attachment not found.')
  }
  return row.objectKey
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function listSubmissions(
  assignmentId: string,
  query: SubmissionListQuery,
  actor: Actor,
): Promise<{ data: SubmissionDetail[] }> {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  assertCanManage(assignment, actor)

  const where: SQL[] = [
    eq(assignmentSubmissions.assignmentId, assignmentId),
  ]
  if (query.status) {
    where.push(eq(assignmentSubmissions.status, query.status))
  }
  const rows = await client
    .select({
      submission: assignmentSubmissions,
      studentName: sql<string>`trim(concat(${students.firstName}, ' ', ${students.lastName}))`,
      admissionNumber: students.admissionNumber,
      assignmentTitle: assignments.title,
      maxScore: assignments.maxScore,
    })
    .from(assignmentSubmissions)
    .innerJoin(
      students,
      eq(assignmentSubmissions.studentId, students.id),
    )
    .innerJoin(
      assignments,
      eq(assignmentSubmissions.assignmentId, assignments.id),
    )
    .where(and(...where))
    .orderBy(asc(students.admissionNumber))

  return {
    data: rows.map((r) =>
      toJsonModel<SubmissionDetail>({
        ...r.submission,
        studentName: r.studentName,
        admissionNumber: r.admissionNumber,
        assignmentTitle: r.assignmentTitle,
        maxScore: r.maxScore,
      }),
    ),
  }
}

export async function getMySubmission(
  assignmentId: string,
  actor: Actor,
): Promise<AssignmentSubmission | null> {
  const client = await db()
  if (!actor.studentId) {
    throw smsForbidden()
  }
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  if (
    assignment.status !== 'published' ||
    !(await studentIsEnrolled(client, actor.studentId, assignment))
  ) {
    throw smsNotFound('Assignment not found.')
  }
  const [row] = await client
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, actor.studentId),
      ),
    )
    .limit(1)
  return row ? toJsonModel<AssignmentSubmission>(row) : null
}

export interface SubmissionFileAccess {
  objectKey: string
  fileName: string
  mimeType: string | null
}

export async function getMySubmissionFile(
  assignmentId: string,
  actor: Actor,
): Promise<SubmissionFileAccess> {
  const client = await db()
  if (!actor.studentId) {
    throw smsForbidden()
  }
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  if (!(await studentIsEnrolled(client, actor.studentId, assignment))) {
    throw smsNotFound('Assignment not found.')
  }
  const [row] = await client
    .select({
      objectKey: assignmentSubmissions.objectKey,
      fileName: assignmentSubmissions.fileName,
      mimeType: assignmentSubmissions.mimeType,
    })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, actor.studentId),
      ),
    )
    .limit(1)
  if (!row?.objectKey) {
    throw smsNotFound('No submitted file.')
  }
  return row as SubmissionFileAccess
}

export async function getStudentSubmissionFile(
  assignmentId: string,
  studentId: string,
  actor: Actor,
): Promise<SubmissionFileAccess> {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  assertCanManage(assignment, actor)
  const [row] = await client
    .select({
      objectKey: assignmentSubmissions.objectKey,
      fileName: assignmentSubmissions.fileName,
      mimeType: assignmentSubmissions.mimeType,
    })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId),
      ),
    )
    .limit(1)
  if (!row?.objectKey) {
    throw smsNotFound('No submitted file.')
  }
  return row as SubmissionFileAccess
}

// Students create/update their own submission. Graded submissions are
// locked; file replacement is supplied by the multipart route.
export async function upsertMySubmission(
  assignmentId: string,
  input: SubmissionUpsert,
  actor: Actor,
  file?: SubmissionFileMeta,
): Promise<{ row: AssignmentSubmission; previousObjectKey: string | null }> {
  const client = await db()
  if (!actor.studentId) {
    throw smsForbidden()
  }
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  if (
    assignment.status !== 'published' ||
    !(await studentIsEnrolled(client, actor.studentId, assignment))
  ) {
    throw smsNotFound('Assignment not found.')
  }

  const [existing] = await client
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, actor.studentId),
      ),
    )
    .limit(1)

  if (existing?.status === 'graded' || existing?.status === 'returned') {
    throw smsConflict(
      'This submission has already been graded and cannot be changed.',
    )
  }

  if (!file && input.textContent === undefined && !input.removeFile) {
    throw smsFieldError('form', 'Nothing to save.')
  }

  const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (input.textContent !== undefined) {
    setValues.textContent = input.textContent
  }
  if (file) {
    setValues.objectKey = file.objectKey
    setValues.fileName = file.fileName
    setValues.mimeType = file.mimeType
    setValues.sizeBytes = file.sizeBytes
  } else if (input.removeFile) {
    setValues.objectKey = null
    setValues.fileName = null
    setValues.mimeType = null
    setValues.sizeBytes = null
  }

  if (existing) {
    const [row] = await client
      .update(assignmentSubmissions)
      .set(setValues)
      .where(eq(assignmentSubmissions.id, existing.id))
      .returning()
    return {
      row: toJsonModel<AssignmentSubmission>(row!),
      previousObjectKey: existing.objectKey,
    }
  }

  const [row] = await client
    .insert(assignmentSubmissions)
    .values({
      assignmentId,
      studentId: actor.studentId,
      textContent: input.textContent ?? null,
      objectKey: file?.objectKey ?? null,
      fileName: file?.fileName ?? null,
      mimeType: file?.mimeType ?? null,
      sizeBytes: file?.sizeBytes ?? null,
      status: 'draft',
    })
    .returning()
  return {
    row: toJsonModel<AssignmentSubmission>(row!),
    previousObjectKey: null,
  }
}

export async function submitMySubmission(
  assignmentId: string,
  actor: Actor,
) {
  const client = await db()
  if (!actor.studentId) {
    throw smsForbidden()
  }
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  const [existing] = await client
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, actor.studentId),
      ),
    )
    .limit(1)
  if (!existing) {
    throw smsConflict('Save your work before submitting.')
  }
  if (existing.status === 'graded' || existing.status === 'returned') {
    throw smsConflict('This submission has already been graded.')
  }
  const hasContent = Boolean(existing.textContent || existing.objectKey)
  if (!hasContent) {
    throw smsConflict('Add text or upload a file before submitting.')
  }
  const isLate =
    assignment.dueDate !== null &&
    new Date(assignment.dueDate).getTime() < Date.now()
  const [row] = await client
    .update(assignmentSubmissions)
    .set({
      status: isLate ? 'late' : 'submitted',
      submittedAt: existing.submittedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assignmentSubmissions.id, existing.id))
    .returning()
  return toJsonModel<AssignmentSubmission>(row!)
}

export async function gradeSubmission(
  assignmentId: string,
  studentId: string,
  input: SubmissionGrade,
  actor: Actor,
) {
  const client = await db()
  const assignment = await getRawAssignmentOrThrow(client, assignmentId)
  assertCanManage(assignment, actor)

  const [existing] = await client
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId),
      ),
    )
    .limit(1)
  if (!existing) {
    throw smsNotFound('Submission not found.')
  }
  if (input.score > assignment.maxScore) {
    throw smsFieldError(
      'score',
      `Score cannot exceed the maximum of ${assignment.maxScore}.`,
    )
  }
  const [row] = await client
    .update(assignmentSubmissions)
    .set({
      score: input.score,
      feedback: input.feedback ?? null,
      status: input.status ?? 'graded',
      gradedById: actor.teacherId,
      gradedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assignmentSubmissions.id, existing.id))
    .returning()
  return toJsonModel<AssignmentSubmission>(row!)
}

// ---------------------------------------------------------------------------
// Student-facing assignment board
// ---------------------------------------------------------------------------

export async function listMyAssignments(
  query: MyAssignmentListQuery,
  actor: Actor,
): Promise<{ data: AssignmentListItem[] }> {
  const client = await db()
  if (!actor.studentId) {
    throw smsForbidden()
  }
  const where: SQL[] = [eq(assignments.status, 'published')]
  if (query.sessionId) {
    where.push(eq(assignments.sessionId, query.sessionId))
  }
  if (query.classId) {
    where.push(eq(assignments.classId, query.classId))
  }
  if (query.subjectId) {
    where.push(eq(assignments.subjectId, query.subjectId))
  }

  const rows = await client
    .select({
      ...nameJoinFields,
      assignment: assignments,
      mySubmission: assignmentSubmissions,
    })
    .from(assignments)
    .innerJoin(classes, eq(assignments.classId, classes.id))
    .leftJoin(sections, eq(assignments.sectionId, sections.id))
    .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
    .innerJoin(teachers, eq(assignments.teacherId, teachers.id))
    .innerJoin(
      academicSessions,
      eq(assignments.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(assignments.termId, terms.id))
    .innerJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.studentId, actor.studentId),
        eq(studentEnrollments.status, 'active'),
        eq(studentEnrollments.sessionId, assignments.sessionId),
        eq(studentEnrollments.classId, assignments.classId),
        or(
          isNull(assignments.sectionId),
          isNull(studentEnrollments.sectionId),
          eq(studentEnrollments.sectionId, assignments.sectionId),
        ),
      ),
    )
    .leftJoin(
      assignmentSubmissions,
      and(
        eq(assignmentSubmissions.assignmentId, assignments.id),
        eq(assignmentSubmissions.studentId, actor.studentId),
      ),
    )
    .where(and(...where))
    .orderBy(desc(assignments.dueDate), desc(assignments.createdAt))

  // A student enrolled in two sections of one class could match a
  // whole-class assignment twice; de-dupe on assignment id.
  const seen = new Map<string, AssignmentListItem>()
  for (const row of rows) {
    if (seen.has(row.assignment.id)) {
      continue
    }
    seen.set(
      row.assignment.id,
      toJsonModel<AssignmentListItem>({
        ...flattenAssignment(row),
        mySubmission: row.mySubmission ? toJsonModel(row.mySubmission) : null,
      }),
    )
  }
  return { data: [...seen.values()] }
}
