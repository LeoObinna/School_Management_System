/**
 * PostgreSQL enums shared across the SMS schema.
 *
 * These are fixed workflow statuses (not configurable school policy).
 * Configurable data such as class levels, section names, terms and
 * grading ranges are stored as data rows, never hard-coded here.
 */
import { pgEnum } from 'drizzle-orm/pg-core'

// Student lifecycle (README §14)
export const studentStatusEnum = pgEnum('student_status', [
  'applicant',
  'admitted',
  'enrolled',
  'active',
  'graduated',
  'transferred',
  'withdrawn',
  'archived',
])

// Enrollment status
export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'active',
  'completed',
  'promoted',
  'repeated',
  'withdrawn',
])

// Attendance (README §15)
export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'late',
  'excused',
])

// Attendance session approval state
export const attendanceSessionStatusEnum = pgEnum(
  'attendance_session_status',
  ['open', 'submitted', 'approved'],
)

// Result workflow (README §18)
export const resultStatusEnum = pgEnum('result_status', [
  'draft',
  'submitted',
  'approved',
  'published',
])

// Assignment / resource publication state
export const publicationStatusEnum = pgEnum('publication_status', [
  'draft',
  'scheduled',
  'published',
  'archived',
])

// Submission state
export const submissionStatusEnum = pgEnum('submission_status', [
  'draft',
  'submitted',
  'late',
  'graded',
  'returned',
])

// Admission workflow (README §20)
export const admissionStatusEnum = pgEnum('admission_status', [
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
])

// Invoice / payment financial state
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'verified',
  'failed',
  'refunded',
])

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'bank_transfer',
  'card',
  'online_gateway',
  'cheque',
  'other',
])

// Gender
export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])

// Announcement audience
export const audienceEnum = pgEnum('audience', [
  'all',
  'staff',
  'teachers',
  'students',
  'parents',
  'admins',
])

// Message / notification state
export const notificationStatusEnum = pgEnum('notification_status', [
  'unread',
  'read',
])

export const messageDirectionEnum = pgEnum('message_direction', [
  'inbound',
  'outbound',
])

// Timetable weekday (1 = Monday ... 7 = Sunday, ISO)
export const weekdayEnum = pgEnum('weekday', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])
