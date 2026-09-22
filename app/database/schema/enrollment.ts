/**
 * Enrollment, teacher assignment and timetable tables.
 *
 * teacher_subjects, teacher_class_assignments, student_enrollments,
 * timetable_entries.
 *
 * Enrollment preserves full historical context (session, term, class,
 * section). Historical placement is NEVER inferred from the student's
 * current class (README §13).
 *
 * Phase 2 of the D1 migration (2026-09-22) converted this file from
 * PostgreSQL to SQLite/D1: `pgTable` → `sqliteTable`, `uuid` → `text`
 * with `crypto.randomUUID()` runtime default, `varchar` → `text`,
 * `timestamp` → `text` ISO-8601, `date` → `text` YYYY-MM-DD,
 * `time` → `text` HH:MM:SS, `boolean` → `integer` 0/1.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { students, teachers } from './people'
import {
  academicSessions,
  terms,
  classes,
  sections,
  subjects,
} from './academics'
import { enrollmentStatusEnum, weekdayEnum } from './enums'

// ---------------------------------------------------------------------------
// Teacher <-> Subject
// ---------------------------------------------------------------------------
export const teacherSubjects = sqliteTable(
  'teacher_subjects',
  {
    teacherId: text('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teacherId, t.subjectId] }),
    subjectIdx: index('teacher_subjects_subject_idx').on(t.subjectId),
  }),
)

// ---------------------------------------------------------------------------
// Teacher <-> Class (and optionally section) assignment
// ---------------------------------------------------------------------------
export const teacherClassAssignments = sqliteTable(
  'teacher_class_assignments',
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
      onDelete: 'cascade',
    }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    isPrimaryTeacher: integer('is_primary_teacher', { mode: 'boolean' })
      .default(false)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    teacherIdx: index('tca_teacher_idx').on(t.teacherId),
    classIdx: index('tca_class_idx').on(t.classId),
    uniqueAssignment: uniqueIndex('tca_unique_idx').on(
      t.teacherId,
      t.classId,
      t.sectionId,
      t.subjectId,
      t.sessionId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Student enrollments (historical record)
// ---------------------------------------------------------------------------
export const studentEnrollments = sqliteTable(
  'student_enrollments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'restrict',
    }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'restrict',
    }),
    rollNumber: text('roll_number'),
    enrollmentDate: text('enrollment_date').notNull(),
    status: enrollmentStatusEnum('status').default('active').notNull(),
    notes: text('notes'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    studentIdx: index('enrollments_student_idx').on(t.studentId),
    sessionIdx: index('enrollments_session_idx').on(t.sessionId),
    // Prevent duplicate enrollment for a student in the same
    // session + term + class + section.
    uniqueEnrollment: uniqueIndex('enrollments_unique_idx').on(
      t.studentId,
      t.sessionId,
      t.termId,
      t.classId,
      t.sectionId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Timetable entries
// ---------------------------------------------------------------------------
export const timetableEntries = sqliteTable(
  'timetable_entries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'cascade',
    }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'cascade',
    }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    room: text('room'),
    weekday: weekdayEnum('weekday').notNull(),
    startTime: text('start_time').notNull(), // HH:MM:SS
    endTime: text('end_time').notNull(), // HH:MM:SS
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    classIdx: index('timetable_class_idx').on(
      t.classId,
      t.sectionId,
      t.weekday,
    ),
    teacherIdx: index('timetable_teacher_idx').on(t.teacherId, t.weekday),
    roomIdx: index('timetable_room_idx').on(t.room, t.weekday),
  }),
)
