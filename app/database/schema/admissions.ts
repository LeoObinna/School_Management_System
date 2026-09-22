/**
 * Admissions tables (README §20).
 *
 * Application -> Documents -> Review -> Assessment/Interview -> Decision
 * -> Admission -> Enrollment.
 *
 * Documents are R2 objects with metadata here. A successful admission
 * can transition into a students record + enrollment (Phase 9).
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `uuid` → `text` IDs, `varchar` → `text`, `timestamp` →
 * text ISO-8601, `date` → text YYYY-MM-DD, `bigint` size_bytes →
 * `integer` (SQLite INTEGER is 64-bit).
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { users } from './core'
import { classes } from './academics'
import { admissionStatusEnum, genderEnum } from './enums'

// ---------------------------------------------------------------------------
// Admission applications
// ---------------------------------------------------------------------------
export const admissionApplications = sqliteTable(
  'admission_applications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationNumber: text('application_number').notNull(),
    sessionId: text('session_id'),
    intendedClassId: text('intended_class_id').references(() => classes.id, {
      onDelete: 'set null',
    }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    otherNames: text('other_names'),
    gender: genderEnum('gender'),
    dateOfBirth: text('date_of_birth'),
    nationality: text('nationality'),
    guardianName: text('guardian_name'),
    guardianPhone: text('guardian_phone'),
    guardianEmail: text('guardian_email'),
    address: text('address'),
    status: admissionStatusEnum('status').default('applied').notNull(),
    previousSchool: text('previous_school'),
    decisionNotes: text('decision_notes'),
    reviewedById: text('reviewed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: text('reviewed_at'),
    decidedAt: text('decided_at'),
    admittedStudentId: text('admitted_student_id'), // linked after conversion
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    applicationNoIdx: uniqueIndex('admission_apps_no_idx').on(
      t.applicationNumber,
    ),
    statusIdx: index('admission_apps_status_idx').on(t.status),
  }),
)

// ---------------------------------------------------------------------------
// Admission documents (R2 metadata)
// ---------------------------------------------------------------------------
export const admissionDocuments = sqliteTable('admission_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  applicationId: text('application_id')
    .notNull()
    .references(() => admissionApplications.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  uploadedAt: text('uploaded_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ---------------------------------------------------------------------------
// Admission assessments / interviews
// ---------------------------------------------------------------------------
export const admissionAssessments = sqliteTable('admission_assessments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  applicationId: text('application_id')
    .notNull()
    .references(() => admissionApplications.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  assessmentType: text('assessment_type'), // exam/interview
  scheduledAt: text('scheduled_at'),
  score: text('score'),
  result: text('result'), // pass/fail/consider
  assessorId: text('assessor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
