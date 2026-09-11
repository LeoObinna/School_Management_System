/**
 * Academic foundation tables.
 *
 * academic_sessions, terms, classes, sections, subjects, class_subjects.
 * Sessions/terms/classes/sections/subjects are all configurable data
 * rows — nothing (Nursery/Primary/JSS/SS, A/B/C, term names) is
 * hard-coded in application logic.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  boolean,
  date,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Academic sessions (e.g. 2026/2027 — configurable)
// ---------------------------------------------------------------------------
export const academicSessions = pgTable(
  'academic_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('academic_sessions_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Terms (belong to a session; names/order are configurable)
// ---------------------------------------------------------------------------
export const terms = pgTable(
  'terms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    sequence: integer('sequence').notNull(), // ordering within a session
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const classes = pgTable(
  'classes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    level: varchar('level', { length: 100 }), // crèche/nursery/primary/jss/ss category (configurable)
    sequence: integer('sequence').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('classes_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Sections (belong to a class; A/B/C are configurable)
// ---------------------------------------------------------------------------
export const sections = pgTable(
  'sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    capacity: integer('capacity'),
    room: varchar('room', { length: 100 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull(),
    code: varchar('code', { length: 50 }),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('subjects_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Class <-> Subject (subjects offered by a class)
// ---------------------------------------------------------------------------
export const classSubjects = pgTable(
  'class_subjects',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    isCompulsory: boolean('is_compulsory').default(true).notNull(),
    maxScore: integer('max_score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classId, t.subjectId] }),
    subjectIdx: index('class_subjects_subject_idx').on(t.subjectId),
  }),
)
