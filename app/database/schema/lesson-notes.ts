/**
 * Lesson notes (Phase 16D): teacher-authored weekly notes with
 * optional R2 attachments. Metadata in D1; bytes under the
 * `lesson-notes/` R2 prefix. Notes are owned by the authoring teacher;
 * admins manage all (see server/services/lesson-notes.ts).
 */
import {
  sqliteTable,
  text,
  integer,
  index,
} from 'drizzle-orm/sqlite-core'
import { teachers } from './people'
import { academicSessions, terms, classes, subjects } from './academics'
import { users } from './core'

export const lessonNotes = sqliteTable(
  'lesson_notes',
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
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    // Teaching week within the term (1-52); nullable — not every note
    // is tied to a specific week.
    week: integer('week'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    teacherIdx: index('lesson_notes_teacher_idx').on(t.teacherId, t.createdAt),
    classIdx: index('lesson_notes_class_idx').on(t.classId, t.sessionId),
  }),
)

export const lessonNoteFiles = sqliteTable(
  'lesson_note_files',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text('note_id')
      .notNull()
      .references(() => lessonNotes.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    uploadedById: text('uploaded_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    noteIdx: index('lesson_note_files_note_idx').on(t.noteId),
  }),
)
