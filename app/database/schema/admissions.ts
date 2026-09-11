/**
 * Admissions tables (README §20).
 *
 * Application -> Documents -> Review -> Assessment/Interview -> Decision
 * -> Admission -> Enrollment.
 *
 * Documents are R2 objects with metadata here. A successful admission
 * can transition into a students record + enrollment (Phase 9).
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  date,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { classes } from './academics'
import { admissionStatusEnum, genderEnum } from './enums'

// ---------------------------------------------------------------------------
// Admission applications
// ---------------------------------------------------------------------------
export const admissionApplications = pgTable(
  'admission_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationNumber: varchar('application_number', { length: 50 }).notNull(),
    sessionId: uuid('session_id'),
    intendedClassId: uuid('intended_class_id').references(() => classes.id, {
      onDelete: 'set null',
    }),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    otherNames: varchar('other_names', { length: 150 }),
    gender: genderEnum('gender'),
    dateOfBirth: date('date_of_birth'),
    nationality: varchar('nationality', { length: 100 }),
    guardianName: varchar('guardian_name', { length: 255 }),
    guardianPhone: varchar('guardian_phone', { length: 50 }),
    guardianEmail: varchar('guardian_email', { length: 255 }),
    address: text('address'),
    status: admissionStatusEnum('status').default('applied').notNull(),
    previousSchool: varchar('previous_school', { length: 255 }),
    decisionNotes: text('decision_notes'),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    admittedStudentId: uuid('admitted_student_id'), // linked after conversion
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const admissionDocuments = pgTable('admission_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id')
    .notNull()
    .references(() => admissionApplications.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  objectKey: text('object_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 150 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Admission assessments / interviews
// ---------------------------------------------------------------------------
export const admissionAssessments = pgTable('admission_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id')
    .notNull()
    .references(() => admissionApplications.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 150 }).notNull(),
  assessmentType: varchar('assessment_type', { length: 100 }), // exam/interview
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  score: varchar('score', { length: 50 }),
  result: varchar('result', { length: 100 }), // pass/fail/consider
  assessorId: uuid('assessor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
