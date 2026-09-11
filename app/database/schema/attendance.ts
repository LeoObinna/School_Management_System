/**
 * Attendance tables.
 *
 * attendance_sessions (a marking event for a class/section/date) and
 * attendance_records (one row per student). Statuses: present, absent,
 * late, excused. Duplicate records for the same student/context are
 * prevented by a unique constraint (README §15).
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { students, teachers } from './people'
import { classes, sections } from './academics'
import { academicSessions, terms } from './academics'
import {
  attendanceStatusEnum,
  attendanceSessionStatusEnum,
} from './enums'

// ---------------------------------------------------------------------------
// Attendance sessions
// ---------------------------------------------------------------------------
export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    date: date('date').notNull(),
    status: attendanceSessionStatusEnum('status')
      .default('open')
      .notNull(),
    markedById: uuid('marked_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    approvedById: uuid('approved_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // One attendance session per class/section/date.
    sessionUnique: uniqueIndex('att_sessions_unique_idx').on(
      t.sessionId,
      t.termId,
      t.classId,
      t.sectionId,
      t.date,
    ),
    classIdx: index('att_sessions_class_idx').on(t.classId, t.date),
  }),
)

// ---------------------------------------------------------------------------
// Attendance records (one per student per attendance session)
// ---------------------------------------------------------------------------
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: attendanceStatusEnum('status').notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // Prevent duplicate attendance for the same student + context.
    recordUnique: uniqueIndex('att_records_unique_idx').on(
      t.attendanceSessionId,
      t.studentId,
    ),
    studentIdx: index('att_records_student_idx').on(t.studentId),
  }),
)
