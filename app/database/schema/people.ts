/**
 * People tables.
 *
 * students, parents, teachers, staff_profiles, student_parents.
 *
 * Each person profile may optionally link to a `users` row for login.
 * Historical identity records are never deleted merely because a
 * student leaves (README lifecycle rule).
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
import { users } from './core'
import { classes, sections } from './academics'
import { studentStatusEnum, genderEnum } from './enums'

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
export const students = sqliteTable(
  'students',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    admissionNumber: text('admission_number').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    otherNames: text('other_names'),
    gender: genderEnum('gender'),
    dateOfBirth: text('date_of_birth'),
    bloodGroup: text('blood_group'),
    nationality: text('nationality'),
    religion: text('religion'),
    address: text('address'),
    photoUrl: text('photo_url'),
    status: studentStatusEnum('status').default('applicant').notNull(),
    // Current placement is a convenience only. Historical enrollment
    // must always be read from student_enrollments (README §13).
    currentClassId: text('current_class_id').references(() => classes.id),
    currentSectionId: text('current_section_id').references(
      () => sections.id,
    ),
    enrolledAt: text('enrolled_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => ({
    admissionIdx: uniqueIndex('students_admission_no_idx').on(
      t.admissionNumber,
    ),
    userIdx: index('students_user_idx').on(t.userId),
    statusIdx: index('students_status_idx').on(t.status),
  }),
)

// ---------------------------------------------------------------------------
// Parents / guardians
// ---------------------------------------------------------------------------
export const parents = sqliteTable(
  'parents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    otherNames: text('other_names'),
    email: text('email'),
    phone: text('phone'),
    gender: genderEnum('gender'),
    occupation: text('occupation'),
    address: text('address'),
    photoUrl: text('photo_url'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => ({
    userIdx: index('parents_user_idx').on(t.userId),
    emailIdx: uniqueIndex('parents_email_idx').on(t.email),
  }),
)

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
export const teachers = sqliteTable(
  'teachers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    staffNumber: text('staff_number').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    otherNames: text('other_names'),
    email: text('email'),
    phone: text('phone'),
    gender: genderEnum('gender'),
    qualification: text('qualification'),
    specialization: text('specialization'),
    address: text('address'),
    photoUrl: text('photo_url'),
    hiredAt: text('hired_at'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => ({
    staffIdx: uniqueIndex('teachers_staff_no_idx').on(t.staffNumber),
    userIdx: index('teachers_user_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// Staff profiles (non-teaching staff)
// ---------------------------------------------------------------------------
export const staffProfiles = sqliteTable(
  'staff_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    staffNumber: text('staff_number').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    otherNames: text('other_names'),
    jobTitle: text('job_title'),
    department: text('department'),
    email: text('email'),
    phone: text('phone'),
    gender: genderEnum('gender'),
    hiredAt: text('hired_at'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => ({
    staffIdx: uniqueIndex('staff_profiles_staff_no_idx').on(t.staffNumber),
  }),
)

// ---------------------------------------------------------------------------
// Student <-> Parent (guardian relationship)
// ---------------------------------------------------------------------------
export const studentParents = sqliteTable(
  'student_parents',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    parentId: text('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    relationship: text('relationship').notNull(), // father/mother/guardian/etc.
    isPrimary: integer('is_primary', { mode: 'boolean' })
      .default(false)
      .notNull(),
    isEmergencyContact: integer('is_emergency_contact', {
      mode: 'boolean',
    })
      .default(false)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.parentId] }),
    parentIdx: index('student_parents_parent_idx').on(t.parentId),
  }),
)
