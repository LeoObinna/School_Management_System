/**
 * Enrollment, teacher assignment and timetable tables.
 *
 * teacher_subjects, teacher_class_assignments, student_enrollments,
 * timetable_entries.
 *
 * Enrollment preserves full historical context (session, term, class,
 * section). Historical placement is NEVER inferred from the student's
 * current class (README §13).
 */
import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  time,
  date,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'
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
export const teacherSubjects = pgTable(
  'teacher_subjects',
  {
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
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
export const teacherClassAssignments = pgTable(
  'teacher_class_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'cascade',
    }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    isPrimaryTeacher: boolean('is_primary_teacher')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
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
export const studentEnrollments = pgTable(
  'student_enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: uuid('term_id').references(() => terms.id, {
      onDelete: 'restrict',
    }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'restrict',
    }),
    rollNumber: varchar('roll_number', { length: 50 }),
    enrollmentDate: date('enrollment_date').notNull(),
    status: enrollmentStatusEnum('status').default('active').notNull(),
    notes: varchar('notes', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const timetableEntries = pgTable(
  'timetable_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => terms.id, {
      onDelete: 'cascade',
    }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'cascade',
    }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    room: varchar('room', { length: 100 }),
    weekday: weekdayEnum('weekday').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
