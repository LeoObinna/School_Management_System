/**
 * Admissions domain service (README §20, Phase 9).
 *
 *   Application -> Documents -> Review -> Assessment/Interview
 *   -> Decision -> Admission -> Enrollment
 *
 * Phase 9 is staff-intake only: applicants have no login accounts and
 * every route is permission-guarded, so the actor only carries a user
 * id. Documents are R2 objects with metadata here; the final conversion
 * creates a student record (and optionally a guardian parent) plus an
 * enrollment inside one transaction.
 */
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  runBatch,
  type D1BatchItem,
  type SmsDb,
} from '../utils/pagination'
import {
  isUniqueViolation,
  smsConflict,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import { toJsonList, toJsonModel } from '../utils/serialize'
import {
  academicSessions,
  admissionApplications,
  admissionAssessments,
  admissionDocuments,
  classes,
  parents,
  sections,
  studentEnrollments,
  studentParents,
  students,
  terms,
} from '../../database/schema'
import type {
  ApplicationCreate,
  ApplicationListQuery,
  ApplicationUpdate,
  ApplicationEnroll,
  AssessmentCreate,
  AssessmentUpdate,
} from '../../shared/schemas'
import type {
  AdmissionApplication,
  AdmissionApplicationDetail,
  AdmissionApplicationListItem,
  AdmissionAssessment,
  AdmissionDocument,
  AdmissionEnrollResult,
  AdmissionStatus,
  Paginated,
} from '../../shared/types'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

export interface AdmissionsActor {
  userId: string
}

// ---------------------------------------------------------------------------
// Status workflow
// ---------------------------------------------------------------------------

const OPEN_STATUSES: AdmissionStatus[] = [
  'applied',
  'documents_submitted',
  'under_review',
  'assessment_scheduled',
  'assessed',
  'waitlisted',
  'accepted',
]

// Statuses from which staff may record a decision.
const DECIDABLE_STATUSES: AdmissionStatus[] = [
  'applied',
  'documents_submitted',
  'under_review',
  'assessment_scheduled',
  'assessed',
  'waitlisted',
]

function assertStatus(
  row: AdmissionApplication,
  allowed: AdmissionStatus[],
  message: string,
): void {
  if (!allowed.includes(row.status)) {
    throw smsConflict(
      `${message} Current status is "${row.status.replace('_', ' ')}".`,
    )
  }
}

// drizzle's and() is typed as SQL | undefined; collapse to SQL.
function all(conditions: Array<SQL | undefined>): SQL {
  return and(...conditions) ?? sql`true`
}

// ---------------------------------------------------------------------------
// Application numbering (APP-YYYY-NNNN)
// ---------------------------------------------------------------------------

async function allocateNumber(client: SmsDb): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(admissionApplications)
    .where(like(admissionApplications.applicationNumber, `APP-${year}-%`))
  const n = (Number(rows[0]?.n) || 0) + 1
  return `APP-${year}-${String(n).padStart(4, '0')}`
}

// D1 has no interactive transactions: the number is allocated with a
// pre-insert count, the insert is retried on a unique-index collision
// (concurrent numbering), and the detail is re-read afterwards. The
// caller supplies the insert values and gets the new row id back.
async function insertWithAppNumber(
  values: Omit<typeof admissionApplications.$inferInsert, 'applicationNumber'>,
): Promise<string> {
  const client = await db()
  const applicationId = values.id ?? crypto.randomUUID()
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await allocateNumber(client)
    try {
      await client.insert(admissionApplications).values({
        ...values,
        id: applicationId,
        applicationNumber: number,
        status: 'applied',
      })
      return applicationId
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) continue
      throw error
    }
  }
  throw smsConflict('Could not allocate a unique application number.')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApplicationRow = typeof admissionApplications.$inferSelect

async function applicationOrThrow(
  client: SmsDb,
  id: string,
): Promise<ApplicationRow> {
  const [row] = await client
    .select()
    .from(admissionApplications)
    .where(eq(admissionApplications.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Application not found.')
  return row
}

function applicationDocuments(client: SmsDb, applicationId: string) {
  return client
    .select()
    .from(admissionDocuments)
    .where(eq(admissionDocuments.applicationId, applicationId))
    .orderBy(asc(admissionDocuments.uploadedAt))
}

function applicationAssessments(client: SmsDb, applicationId: string) {
  return client
    .select()
    .from(admissionAssessments)
    .where(eq(admissionAssessments.applicationId, applicationId))
    .orderBy(
      asc(admissionAssessments.scheduledAt),
      asc(admissionAssessments.createdAt),
    )
}

async function loadDetail(
  client: SmsDb,
  id: string,
): Promise<AdmissionApplicationDetail> {
  const [row, names, docRows, assessmentRows] = await Promise.all([
    applicationOrThrow(client, id),
    client
      .select({
        sessionName: academicSessions.name,
        className: classes.name,
      })
      .from(admissionApplications)
      .leftJoin(
        academicSessions,
        eq(admissionApplications.sessionId, academicSessions.id),
      )
      .leftJoin(classes, eq(admissionApplications.intendedClassId, classes.id))
      .where(eq(admissionApplications.id, id))
      .limit(1),
    applicationDocuments(client, id),
    applicationAssessments(client, id),
  ])

  return {
    ...toJsonModel<AdmissionApplication>(row),
    sessionName: names[0]?.sessionName ?? null,
    className: names[0]?.className ?? null,
    documents: toJsonList<AdmissionDocument>(docRows),
    assessments: toJsonList<AdmissionAssessment>(assessmentRows),
  }
}

// Convert '' from form fields into undefined so old columns are preserved.
function blankToUndefined<T extends object>(input: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = value === '' ? undefined : value
  }
  return out as T
}

// Empty strings from form fields mean "leave unchanged"; explicit null
// clears a nullable column.
function blank<T>(value: T | '' | null | undefined): T | null | undefined {
  return value === '' || value === undefined ? undefined : value
}

// ISO datetime strings become Date instances for timestamp columns.
function scheduledAtValue(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null) return null
  return value ? new Date(value).toISOString() : undefined
}

// Recompute pipeline status after an assessment change.
function assessmentDerivedStatus(
  current: AdmissionStatus,
  hasOutcome: boolean,
  hasSchedule: boolean,
): AdmissionStatus | null {
  if (
    hasOutcome &&
    (current === 'under_review' || current === 'assessment_scheduled')
  ) {
    return 'assessed'
  }
  if (
    hasSchedule &&
    (current === 'applied' ||
      current === 'documents_submitted' ||
      current === 'under_review')
  ) {
    return 'assessment_scheduled'
  }
  return null
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function listApplications(
  query: ApplicationListQuery,
): Promise<Paginated<AdmissionApplicationListItem>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    query.sessionId
      ? eq(admissionApplications.sessionId, query.sessionId)
      : undefined,
    query.intendedClassId
      ? eq(admissionApplications.intendedClassId, query.intendedClassId)
      : undefined,
    query.status ? eq(admissionApplications.status, query.status) : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(
        like(admissionApplications.applicationNumber, pattern),
        like(admissionApplications.firstName, pattern),
        like(admissionApplications.lastName, pattern),
        like(admissionApplications.guardianName, pattern),
        like(admissionApplications.guardianPhone, pattern),
      )!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(admissionApplications)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select({
      application: admissionApplications,
      sessionName: academicSessions.name,
      className: classes.name,
    })
    .from(admissionApplications)
    .leftJoin(
      academicSessions,
      eq(admissionApplications.sessionId, academicSessions.id),
    )
    .leftJoin(classes, eq(admissionApplications.intendedClassId, classes.id))
    .where(filter)
    .orderBy(desc(admissionApplications.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const ids = rows.map((r) => r.application.id)
  const [docAgg, assessAgg] = await Promise.all([
    ids.length
      ? client
          .select({
            applicationId: admissionDocuments.applicationId,
            n: sql<number>`cast(count(*) as integer)`,
          })
          .from(admissionDocuments)
          .where(inArray(admissionDocuments.applicationId, ids))
          .groupBy(admissionDocuments.applicationId)
      : Promise.resolve([]),
    ids.length
      ? client
          .select({
            applicationId: admissionAssessments.applicationId,
            n: sql<number>`cast(count(*) as integer)`,
          })
          .from(admissionAssessments)
          .where(inArray(admissionAssessments.applicationId, ids))
          .groupBy(admissionAssessments.applicationId)
      : Promise.resolve([]),
  ])
  const docCounts = new Map(docAgg.map((r) => [r.applicationId, Number(r.n)]))
  const assessCounts = new Map(
    assessAgg.map((r) => [r.applicationId, Number(r.n)]),
  )

  const data = rows.map((r) => ({
    ...toJsonModel<AdmissionApplication>(r.application),
    applicantName:
      `${r.application.firstName} ${r.application.lastName}`.trim(),
    sessionName: r.sessionName ?? null,
    className: r.className ?? null,
    documentCount: docCounts.get(r.application.id) ?? 0,
    assessmentCount: assessCounts.get(r.application.id) ?? 0,
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

export async function getApplication(
  id: string,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  return loadDetail(client, id)
}

export async function createApplication(
  input: ApplicationCreate,
): Promise<AdmissionApplicationDetail> {
  const values = blankToUndefined(input)
  const client = await db()
  if (values.sessionId) await assertSession(client, values.sessionId)
  if (values.intendedClassId) {
    await assertClass(client, values.intendedClassId)
  }

  const id = await insertWithAppNumber({ ...values })
  return loadDetail(client, id)
}

export async function updateApplication(
  id: string,
  input: ApplicationUpdate,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const row = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(row),
    OPEN_STATUSES,
    'A decided, enrolled or withdrawn application cannot be edited.',
  )
  const values = blankToUndefined(input)
  if (values.sessionId) await assertSession(client, values.sessionId)
  if (values.intendedClassId) await assertClass(client, values.intendedClassId)

  const [updated] = await client
    .update(admissionApplications)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(admissionApplications.id, id))
    .returning()
  if (!updated) throw smsNotFound('Application not found.')
  return loadDetail(client, id)
}

// ---------------------------------------------------------------------------
// Workflow actions
// ---------------------------------------------------------------------------

export async function reviewApplication(
  id: string,
  notes: string | undefined,
  actor: AdmissionsActor,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const row = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(row),
    DECIDABLE_STATUSES,
    'Only open applications can be marked under review.',
  )
  await client
    .update(admissionApplications)
    .set({
      status: 'under_review',
      reviewedById: actor.userId,
      reviewedAt: new Date().toISOString(),
      decisionNotes: notes !== undefined ? notes : row.decisionNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissionApplications.id, id))
  return loadDetail(client, id)
}

export async function decideApplication(
  id: string,
  decision: 'accepted' | 'rejected',
  decisionNotes: string,
  actor: AdmissionsActor,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const row = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(row),
    DECIDABLE_STATUSES,
    `Application cannot be ${decision}.`,
  )
  await client
    .update(admissionApplications)
    .set({
      status: decision,
      decisionNotes,
      reviewedById: row.reviewedById ?? actor.userId,
      reviewedAt: row.reviewedAt ?? new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissionApplications.id, id))
  return loadDetail(client, id)
}

export async function waitlistApplication(
  id: string,
  notes: string | undefined,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const row = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(row),
    [
      'applied',
      'documents_submitted',
      'under_review',
      'assessment_scheduled',
      'assessed',
    ],
    'Application cannot be waitlisted.',
  )
  await client
    .update(admissionApplications)
    .set({
      status: 'waitlisted',
      decisionNotes: notes ?? row.decisionNotes,
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissionApplications.id, id))
  return loadDetail(client, id)
}

export async function withdrawApplication(
  id: string,
  notes: string | undefined,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const row = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(row),
    OPEN_STATUSES,
    'A terminal application cannot be withdrawn.',
  )
  await client
    .update(admissionApplications)
    .set({
      status: 'withdrawn',
      decisionNotes: notes ?? row.decisionNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissionApplications.id, id))
  return loadDetail(client, id)
}

// ---------------------------------------------------------------------------
// Assessments / interviews
// ---------------------------------------------------------------------------

export async function addAssessment(
  applicationId: string,
  input: AssessmentCreate,
  actor: AdmissionsActor,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const app = await applicationOrThrow(client, applicationId)
  assertStatus(
    toJsonModel<AdmissionApplication>(app),
    OPEN_STATUSES,
    'Assessments cannot be added to a terminal application.',
  )

  const statements: D1BatchItem[] = [
    client.insert(admissionAssessments).values({
      applicationId,
      title: input.title,
      assessmentType: input.assessmentType,
      scheduledAt: scheduledAtValue(input.scheduledAt),
      score: blank(input.score),
      result: blank(input.result),
      notes: blank(input.notes),
      assessorId: actor.userId,
    }),
  ]
  const derived = assessmentDerivedStatus(
    app.status,
    Boolean(input.score || input.result),
    Boolean(input.scheduledAt),
  )
  if (derived) {
    statements.push(
      client
        .update(admissionApplications)
        .set({ status: derived, updatedAt: new Date().toISOString() })
        .where(eq(admissionApplications.id, applicationId)),
    )
  }
  await runBatch(client, statements)
  return loadDetail(client, applicationId)
}

export async function updateAssessment(
  applicationId: string,
  assessmentId: string,
  input: AssessmentUpdate,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const [app, assessment] = await Promise.all([
    applicationOrThrow(client, applicationId),
    client
      .select()
      .from(admissionAssessments)
      .where(
        and(
          eq(admissionAssessments.id, assessmentId),
          eq(admissionAssessments.applicationId, applicationId),
        ),
      )
      .limit(1),
  ])
  if (!assessment[0]) throw smsNotFound('Assessment not found.')
  assertStatus(
    toJsonModel<AdmissionApplication>(app),
    OPEN_STATUSES,
    'Assessments cannot be edited on a terminal application.',
  )

  await client
    .update(admissionAssessments)
    .set({
      title: input.title,
      assessmentType: input.assessmentType,
      scheduledAt: scheduledAtValue(input.scheduledAt),
      score: blank(input.score),
      result: blank(input.result),
      notes: blank(input.notes),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissionAssessments.id, assessmentId))

  const merged = { ...assessment[0], ...blankToUndefined(input) }
  const derived = assessmentDerivedStatus(
    app.status,
    Boolean(merged.score),
    Boolean(merged.scheduledAt),
  )
  if (derived) {
    await client
      .update(admissionApplications)
      .set({ status: derived, updatedAt: new Date().toISOString() })
      .where(eq(admissionApplications.id, applicationId))
  }
  return loadDetail(client, applicationId)
}

export async function deleteAssessment(
  applicationId: string,
  assessmentId: string,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  await applicationOrThrow(client, applicationId)
  const deleted = await client
    .delete(admissionAssessments)
    .where(
      and(
        eq(admissionAssessments.id, assessmentId),
        eq(admissionAssessments.applicationId, applicationId),
      ),
    )
    .returning({ id: admissionAssessments.id })
  if (deleted.length === 0) throw smsNotFound('Assessment not found.')
  return loadDetail(client, applicationId)
}

// ---------------------------------------------------------------------------
// Documents (R2 metadata; bytes are handled by the route layer)
// ---------------------------------------------------------------------------

export interface StoredDocumentInput {
  documentType: string
  objectKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export async function addDocument(
  applicationId: string,
  input: StoredDocumentInput,
): Promise<AdmissionApplicationDetail> {
  const client = await db()
  const app = await applicationOrThrow(client, applicationId)
  assertStatus(
    toJsonModel<AdmissionApplication>(app),
    OPEN_STATUSES,
    'Documents cannot be added to a terminal application.',
  )

  const statements: D1BatchItem[] = [
    client.insert(admissionDocuments).values({ applicationId, ...input }),
  ]
  if (app.status === 'applied') {
    statements.push(
      client
        .update(admissionApplications)
        .set({ status: 'documents_submitted', updatedAt: new Date().toISOString() })
        .where(eq(admissionApplications.id, applicationId)),
    )
  }
  await runBatch(client, statements)
  return loadDetail(client, applicationId)
}

export async function getDocumentForDownload(
  applicationId: string,
  documentId: string,
): Promise<AdmissionDocument> {
  const client = await db()
  await applicationOrThrow(client, applicationId)
  const [row] = await client
    .select()
    .from(admissionDocuments)
    .where(
      and(
        eq(admissionDocuments.id, documentId),
        eq(admissionDocuments.applicationId, applicationId),
      ),
    )
    .limit(1)
  if (!row) throw smsNotFound('Document not found.')
  return toJsonModel<AdmissionDocument>(row)
}

export async function deleteDocument(
  applicationId: string,
  documentId: string,
): Promise<{ detail: AdmissionApplicationDetail; objectKey: string }> {
  const client = await db()
  await applicationOrThrow(client, applicationId)
  const [row] = await client
    .delete(admissionDocuments)
    .where(
      and(
        eq(admissionDocuments.id, documentId),
        eq(admissionDocuments.applicationId, applicationId),
      ),
    )
    .returning()
  if (!row) throw smsNotFound('Document not found.')
  const detail = await loadDetail(client, applicationId)
  return { detail, objectKey: row.objectKey }
}

// ---------------------------------------------------------------------------
// Admission -> enrollment conversion
// ---------------------------------------------------------------------------

export async function enrollApplication(
  id: string,
  input: ApplicationEnroll,
  actor: AdmissionsActor,
): Promise<AdmissionEnrollResult> {
  const client = await db()
  const app = await applicationOrThrow(client, id)
  assertStatus(
    toJsonModel<AdmissionApplication>(app),
    ['accepted', 'waitlisted'],
    'Only accepted or waitlisted applications can be enrolled.',
  )
  if (app.admittedStudentId) {
    throw smsConflict('This application has already been converted.')
  }

  // Referential checks before the transaction.
  const [sessionRow] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, input.sessionId))
    .limit(1)
  if (!sessionRow)
    throw smsFieldError('sessionId', 'Academic session not found.')
  const [classRow] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, input.classId))
    .limit(1)
  if (!classRow) throw smsFieldError('classId', 'Class not found.')
  if (input.sectionId) {
    const [section] = await client
      .select({ classId: sections.classId })
      .from(sections)
      .where(eq(sections.id, input.sectionId))
      .limit(1)
    if (!section) throw smsFieldError('sectionId', 'Section not found.')
    if (section.classId !== input.classId) {
      throw smsFieldError('sectionId', 'Section does not belong to the class.')
    }
  }
  if (input.termId) {
    const [term] = await client
      .select({ sessionId: terms.sessionId })
      .from(terms)
      .where(eq(terms.id, input.termId))
      .limit(1)
    if (!term) throw smsFieldError('termId', 'Term not found.')
    if (term.sessionId !== input.sessionId) {
      throw smsFieldError('termId', 'Term does not belong to the session.')
    }
  }
  const [duplicate] = await client
    .select({ id: students.id })
    .from(students)
    .where(eq(students.admissionNumber, input.admissionNumber))
    .limit(1)
  if (duplicate) {
    throw smsConflict('A student with this admission number already exists.')
  }

  // Guardian resolution that used to happen inside the interactive
  // transaction is resolved BEFORE the batch: find an existing parent by
  // email, or prepare an explicit new parent id. All ids are app-
  // generated UUIDs, so the batch statements can reference each other
  // without reading inserted rows back.
  let parentRow: typeof parents.$inferSelect | null = null
  let newParentId: string | null = null
  if (input.createGuardianParent) {
    if (!app.guardianName) {
      throw smsFieldError(
        'createGuardianParent',
        'Application has no guardian name to create a parent record from.',
      )
    }
    if (app.guardianEmail) {
      const [existing] = await client
        .select()
        .from(parents)
        .where(eq(parents.email, app.guardianEmail))
        .limit(1)
      if (existing) parentRow = existing
    }
    if (!parentRow) {
      newParentId = crypto.randomUUID()
    }
  }

  const studentId = crypto.randomUUID()
  const enrollmentId = crypto.randomUUID()

  try {
    const statements: D1BatchItem[] = [
      client.insert(students).values({
        id: studentId,
        admissionNumber: input.admissionNumber,
        firstName: app.firstName,
        lastName: app.lastName,
        otherNames: app.otherNames,
        gender: app.gender,
        dateOfBirth: app.dateOfBirth,
        nationality: app.nationality,
        address: app.address,
        status: 'enrolled',
        currentClassId: input.classId,
        currentSectionId: input.sectionId ?? null,
        enrolledAt: input.enrollmentDate,
      }),
    ]
    if (newParentId) {
      const parts = app.guardianName!.trim().split(/\s+/)
      statements.push(
        client.insert(parents).values({
          id: newParentId,
          firstName: parts[0]!,
          lastName: parts.slice(1).join(' ') || parts[0]!,
          email: app.guardianEmail,
          phone: app.guardianPhone,
          address: app.address,
          isActive: true,
        }),
      )
    }
    if (input.createGuardianParent) {
      statements.push(
        client
          .insert(studentParents)
          .values({
            studentId,
            parentId: parentRow?.id ?? newParentId!,
            relationship: 'guardian',
            isPrimary: true,
            isEmergencyContact: false,
          })
          .onConflictDoNothing(),
      )
    }
    statements.push(
      client.insert(studentEnrollments).values({
        id: enrollmentId,
        studentId,
        sessionId: input.sessionId,
        termId: input.termId ?? null,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
        rollNumber: input.rollNumber ?? null,
        enrollmentDate: input.enrollmentDate,
        status: 'active',
      }),
    )
    statements.push(
      client
        .update(admissionApplications)
        .set({
          status: 'enrolled',
          admittedStudentId: studentId,
          decidedAt: app.decidedAt ?? new Date().toISOString(),
          reviewedById: app.reviewedById ?? actor.userId,
          reviewedAt: app.reviewedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(admissionApplications.id, id)),
    )
    await runBatch(client, statements)

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
      studentName: sql<string>`trim(${students.firstName} || ' ' || ${students.lastName})`,
      className: classes.name,
      sectionName: sections.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    }
    const [enrollRow] = await client
      .select(enrollmentDetailSelect)
      .from(studentEnrollments)
      .innerJoin(students, eq(studentEnrollments.studentId, students.id))
      .innerJoin(
        academicSessions,
        eq(studentEnrollments.sessionId, academicSessions.id),
      )
      .leftJoin(terms, eq(studentEnrollments.termId, terms.id))
      .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
      .leftJoin(sections, eq(studentEnrollments.sectionId, sections.id))
      .where(eq(studentEnrollments.id, enrollmentId))
      .limit(1)

    if (newParentId && !parentRow) {
      const [created] = await client
        .select()
        .from(parents)
        .where(eq(parents.id, newParentId))
        .limit(1)
      parentRow = created ?? null
    }
    const [student] = await client
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1)
    const application = await loadDetail(client, id)
    return {
      application,
      student: toJsonModel(student!),
      enrollment: toJsonModel(enrollRow!),
      parent: parentRow ? toJsonModel(parentRow) : null,
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw smsConflict(
        'Enrollment conflict: the admission number or enrollment already exists.',
      )
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Referential checks
// ---------------------------------------------------------------------------

async function assertSession(client: SmsDb, sessionId: string): Promise<void> {
  const [row] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, sessionId))
    .limit(1)
  if (!row) throw smsFieldError('sessionId', 'Academic session not found.')
}

async function assertClass(client: SmsDb, classId: string): Promise<void> {
  const [row] = await client
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1)
  if (!row) throw smsFieldError('intendedClassId', 'Class not found.')
}
