/**
 * Attendance tables.
 *
 * attendance_sessions (a marking event for a class/section/date) and
 * attendance_records (one row per student). Statuses: present, absent,
 * late, excused. Duplicate records for the same student/context are
 * prevented by a unique constraint (README §15).
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1 (text IDs, text ISO-8601 timestamps, text YYYY-MM-DD
 * dates, integer 0/1 booleans).
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
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
export const attendanceSessions = sqliteTable(
  'attendance_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    date: text('date').notNull(),
    status: attendanceSessionStatusEnum('status')
      .default('open')
      .notNull(),
    markedById: text('marked_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    approvedById: text('approved_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    approvedAt: text('approved_at'),
    notes: text('notes'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
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
export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    attendanceSessionId: text('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: attendanceStatusEnum('status').notNull(),
    remark: text('remark'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
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
