/**
 * Assignments, attachments and submissions (README §17).
 *
 * File bytes live in Cloudflare R2; these tables store metadata and
 * relationships in PostgreSQL.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  integer,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { students, teachers } from './people'
import { classes, sections, subjects } from './academics'
import { academicSessions, terms } from './academics'
import { publicationStatusEnum, submissionStatusEnum } from './enums'

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    instructions: text('instructions'),
    maxScore: integer('max_score').default(100).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    status: publicationStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    classIdx: index('assignments_class_idx').on(t.classId, t.sessionId),
    teacherIdx: index('assignments_teacher_idx').on(t.teacherId),
  }),
)

// ---------------------------------------------------------------------------
// Assignment attachments (R2 object metadata)
// ---------------------------------------------------------------------------
export const assignmentAttachments = pgTable('assignment_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(), // R2 key
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 150 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedById: uuid('uploaded_by_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Assignment submissions
// ---------------------------------------------------------------------------
export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    textContent: text('text_content'),
    objectKey: text('object_key'), // R2 key for submitted file
    fileName: varchar('file_name', { length: 255 }),
    mimeType: varchar('mime_type', { length: 150 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    status: submissionStatusEnum('status').default('draft').notNull(),
    score: integer('score'),
    feedback: text('feedback'),
    gradedById: uuid('graded_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // One submission per student per assignment.
    uniqueSubmission: uniqueIndex('submissions_unique_idx').on(
      t.assignmentId,
      t.studentId,
    ),
    studentIdx: index('submissions_student_idx').on(t.studentId),
  }),
)
