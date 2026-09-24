/**
 * SQLite TEXT+CHECK enums shared across the SMS schema.
 *
 * `sqliteEnum(values)` produces a `text(name, { enum: values })`
 * column factory. Drizzle's SQLite core generates a CHECK constraint
 * from the `enum` option, so the database-level guarantee is
 * preserved at write time.
 *
 * The factory pattern `genderEnum('gender')` lets service-layer
 * code call these enums as column builders. Each export retains its
 * TypeScript literal-union type so callers can use values as type
 * parameters.
 *
 * Fixed workflow statuses only — never hard-coded school policy
 * (class levels, section names, term names, grading ranges are
 * stored as data rows).
 */
import { text } from 'drizzle-orm/sqlite-core'

/**
 * Builds a `text` column factory with a CHECK constraint enforcing
 * the supplied values.
 *
 * The returned factory exposes an `enumValues` array (typed as the
 * readonly literal tuple), supporting both runtime iteration
 * (`[...statusEnum.enumValues]`) and type extraction
 * (`(typeof statusEnum.enumValues)[number]`).
 *
 * Usage:
 *   export const genderEnum = sqliteEnum(['male','female','other'] as const)
 *   gender: genderEnum('gender')                              // nullable
 *   status: studentStatusEnum('status').default('applicant').notNull()
 */
function sqliteEnum<T extends string>(values: readonly T[]) {
  // The enum tuple MUST be cast to `[T, ...T[]]` (not to Drizzle's
  // declared `[string, ...string[]]`), so the column's inferred data
  // type stays the literal union (e.g. 'draft'|'published'|…) instead
  // of widening to plain `string`. The runtime contract is identical —
  // a non-empty string tuple producing a CHECK constraint.
  const builder = (name: string) =>
    text(name, { enum: values as unknown as [T, ...T[]] })
  return Object.assign(builder, { enumValues: values })
}

// Student lifecycle (README §14)
export const studentStatusEnum = sqliteEnum([
  'applicant',
  'admitted',
  'enrolled',
  'active',
  'graduated',
  'transferred',
  'withdrawn',
  'archived',
] as const)

// Enrollment status
export const enrollmentStatusEnum = sqliteEnum([
  'active',
  'completed',
  'promoted',
  'repeated',
  'withdrawn',
] as const)

// Attendance (README §15)
export const attendanceStatusEnum = sqliteEnum([
  'present',
  'absent',
  'late',
  'excused',
] as const)

// Attendance session approval state
export const attendanceSessionStatusEnum = sqliteEnum([
  'open',
  'submitted',
  'approved',
] as const)

// Result workflow (README §18)
export const resultStatusEnum = sqliteEnum([
  'draft',
  'submitted',
  'approved',
  'published',
] as const)

// Assignment / resource publication state
export const publicationStatusEnum = sqliteEnum([
  'draft',
  'scheduled',
  'published',
  'archived',
] as const)

// Submission state
export const submissionStatusEnum = sqliteEnum([
  'draft',
  'submitted',
  'late',
  'graded',
  'returned',
] as const)

// Admission workflow (README §20)
export const admissionStatusEnum = sqliteEnum([
  'applied',
  'documents_submitted',
  'under_review',
  'assessment_scheduled',
  'assessed',
  'accepted',
  'rejected',
  'waitlisted',
  'admitted',
  'enrolled',
  'withdrawn',
] as const)

// Invoice / payment financial state
export const invoiceStatusEnum = sqliteEnum([
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
] as const)

export const paymentStatusEnum = sqliteEnum([
  'pending',
  'verified',
  'failed',
  'refunded',
] as const)

export const paymentMethodEnum = sqliteEnum([
  'cash',
  'bank_transfer',
  'card',
  'online_gateway',
  'cheque',
  'other',
] as const)

// Gender
export const genderEnum = sqliteEnum(['male', 'female', 'other'] as const)

// Announcement audience
export const audienceEnum = sqliteEnum([
  'all',
  'staff',
  'teachers',
  'students',
  'parents',
  'admins',
] as const)

// Message / notification state
export const notificationStatusEnum = sqliteEnum(['unread', 'read'] as const)

export const messageDirectionEnum = sqliteEnum([
  'inbound',
  'outbound',
] as const)

// Timetable weekday (1 = Monday ... 7 = Sunday, ISO)
export const weekdayEnum = sqliteEnum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const)

// Document visibility (Phase 14B) — who may read a staff document.
export const documentVisibilityEnum = sqliteEnum([
  'staff', // any authenticated staff member (admin or teacher)
  'admin', // admins only
] as const)

// Inventory (Phase 14C) — stock ledger for books and equipment.
export const inventoryItemTypeEnum = sqliteEnum([
  'book',
  'equipment',
] as const)

export const inventoryConditionEnum = sqliteEnum([
  'new',
  'good',
  'fair',
  'poor',
  'damaged',
] as const)

export const inventoryStatusEnum = sqliteEnum([
  'active', // tracked and usable
  'retired', // removed from service; kept for history
] as const)
