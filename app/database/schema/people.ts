/**
 * People tables.
 *
 * students, parents, teachers, staff_profiles, student_parents.
 *
 * Each person profile may optionally link to a `users` row for login.
 * Historical identity records are never deleted merely because a
 * student leaves (README lifecycle rule).
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  date,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { classes, sections } from './academics'
import { studentStatusEnum, genderEnum } from './enums'

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    admissionNumber: varchar('admission_number', { length: 50 }).notNull(),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    otherNames: varchar('other_names', { length: 150 }),
    gender: genderEnum('gender'),
    dateOfBirth: date('date_of_birth'),
    bloodGroup: varchar('blood_group', { length: 10 }),
    nationality: varchar('nationality', { length: 100 }),
    religion: varchar('religion', { length: 100 }),
    address: text('address'),
    photoUrl: text('photo_url'),
    status: studentStatusEnum('status').default('applicant').notNull(),
    // Current placement is a convenience only. Historical enrollment
    // must always be read from student_enrollments (README §13).
    currentClassId: uuid('current_class_id').references(() => classes.id),
    currentSectionId: uuid('current_section_id').references(
      () => sections.id,
    ),
    enrolledAt: date('enrolled_at'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
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
export const parents = pgTable(
  'parents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    otherNames: varchar('other_names', { length: 150 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    gender: genderEnum('gender'),
    occupation: varchar('occupation', { length: 150 }),
    address: text('address'),
    photoUrl: text('photo_url'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('parents_user_idx').on(t.userId),
    emailIdx: uniqueIndex('parents_email_idx').on(t.email),
  }),
)

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    staffNumber: varchar('staff_number', { length: 50 }).notNull(),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    otherNames: varchar('other_names', { length: 150 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    gender: genderEnum('gender'),
    qualification: varchar('qualification', { length: 255 }),
    specialization: varchar('specialization', { length: 255 }),
    address: text('address'),
    photoUrl: text('photo_url'),
    hiredAt: date('hired_at'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    staffIdx: uniqueIndex('teachers_staff_no_idx').on(t.staffNumber),
    userIdx: index('teachers_user_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// Staff profiles (non-teaching staff)
// ---------------------------------------------------------------------------
export const staffProfiles = pgTable('staff_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  staffNumber: varchar('staff_number', { length: 50 }).notNull(),
  firstName: varchar('first_name', { length: 150 }).notNull(),
  lastName: varchar('last_name', { length: 150 }).notNull(),
  otherNames: varchar('other_names', { length: 150 }),
  jobTitle: varchar('job_title', { length: 150 }),
  department: varchar('department', { length: 150 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  gender: genderEnum('gender'),
  hiredAt: date('hired_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  staffIdx: uniqueIndex('staff_profiles_staff_no_idx').on(t.staffNumber),
}))

// ---------------------------------------------------------------------------
// Student <-> Parent (guardian relationship)
// ---------------------------------------------------------------------------
export const studentParents = pgTable(
  'student_parents',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    relationship: varchar('relationship', { length: 50 }).notNull(), // father/mother/guardian/etc.
    isPrimary: boolean('is_primary').default(false).notNull(),
    isEmergencyContact: boolean('is_emergency_contact').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.parentId] }),
    parentIdx: index('student_parents_parent_idx').on(t.parentId),
  }),
)
