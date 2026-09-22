/**
 * Academic foundation tables.
 *
 * academic_sessions, terms, classes, sections, subjects, class_subjects.
 * Sessions/terms/classes/sections/subjects are all configurable data
 * rows — nothing (Nursery/Primary/JSS/SS, A/B/C, term names) is
 * hard-coded in application logic.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted this file from
 * PostgreSQL to SQLite/D1: `pgTable` → `sqliteTable`, `uuid` → `text`
 * with `crypto.randomUUID()` runtime default, `varchar` → `text`,
 * `timestamp` → `text` ISO-8601, `date` → `text` YYYY-MM-DD,
 * `boolean` → `integer` 0/1 (Drizzle `{ mode: 'boolean' }`).
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// Academic sessions (e.g. 2026/2027 — configurable)
// ---------------------------------------------------------------------------
export const academicSessions = sqliteTable(
  'academic_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    isCurrent: integer('is_current', { mode: 'boolean' })
      .default(false)
      .notNull(),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('academic_sessions_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Terms (belong to a session; names/order are configurable)
// ---------------------------------------------------------------------------
export const terms = sqliteTable(
  'terms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sequence: integer('sequence').notNull(), // ordering within a session
    startDate: text('start_date'),
    endDate: text('end_date'),
    isCurrent: integer('is_current', { mode: 'boolean' })
      .default(false)
      .notNull(),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    sessionTermIdx: uniqueIndex('terms_session_slug_idx').on(
      t.sessionId,
      t.slug,
    ),
    sessionSeqIdx: uniqueIndex('terms_session_seq_idx').on(
      t.sessionId,
      t.sequence,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Classes (levels are configurable, e.g. Primary 1, JSS 2)
// ---------------------------------------------------------------------------
export const classes = sqliteTable(
  'classes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    level: text('level'), // crèche/nursery/primary/jss/ss category (configurable)
    sequence: integer('sequence').default(0).notNull(),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('classes_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Sections (belong to a class; A/B/C are configurable)
// ---------------------------------------------------------------------------
export const sections = sqliteTable(
  'sections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    capacity: integer('capacity'),
    room: text('room'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    classSectionIdx: uniqueIndex('sections_class_slug_idx').on(
      t.classId,
      t.slug,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    code: text('code'),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('subjects_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Class <-> Subject (subjects offered by a class)
// ---------------------------------------------------------------------------
export const classSubjects = sqliteTable(
  'class_subjects',
  {
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    isCompulsory: integer('is_compulsory', { mode: 'boolean' })
      .default(true)
      .notNull(),
    maxScore: integer('max_score'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classId, t.subjectId] }),
    subjectIdx: index('class_subjects_subject_idx').on(t.subjectId),
  }),
)
