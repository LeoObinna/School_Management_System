/**
 * Assignments, attachments and submissions (README §17).
 *
 * File bytes live in Cloudflare R2; these tables store metadata and
 * relationships in D1/SQLite.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `uuid` → `text` IDs, `varchar` → `text`, `timestamp` →
 * text ISO-8601, `bigint` size_bytes → `integer` (SQLite INTEGER is
 * 64-bit, JS-safe up to 2^53), `integer` maxScore stays integer.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { students, teachers } from './people'
import { classes, sections, subjects } from './academics'
import { academicSessions, terms } from './academics'
import { publicationStatusEnum, submissionStatusEnum } from './enums'

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const assignments = sqliteTable(
  'assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    instructions: text('instructions'),
    maxScore: integer('max_score').default(100).notNull(),
    dueDate: text('due_date'),
    publishedAt: text('published_at'),
    status: publicationStatusEnum('status').default('draft').notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
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
export const assignmentAttachments = sqliteTable('assignment_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assignmentId: text('assignment_id')
    .notNull()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(), // R2 key
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  uploadedById: text('uploaded_by_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ---------------------------------------------------------------------------
// Assignment submissions
// ---------------------------------------------------------------------------
export const assignmentSubmissions = sqliteTable(
  'assignment_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    textContent: text('text_content'),
    objectKey: text('object_key'), // R2 key for submitted file
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    submittedAt: text('submitted_at'),
    status: submissionStatusEnum('status').default('draft').notNull(),
    score: integer('score'),
    feedback: text('feedback'),
    gradedById: text('graded_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    gradedAt: text('graded_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
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
