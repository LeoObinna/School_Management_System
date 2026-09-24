/**
 * Reports/audit validation schemas (README §41 Phase 11).
 *
 * Operational report queries (overview, attendance-by-class,
 * enrollments-by-class-status) and the audit log list query. CSV
 * export is gated by `reports.export` at the route layer, not here.
 *
 * `AUDIT_LOG_RESOURCES` is a curated list of resource strings the
 * audit log UI offers as a filter dropdown; the column is free-text
 * so users may type other values too.
 */
import { z } from 'zod'
import {
  dateStringSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

// Mirrors the resource strings used by writeAudit call sites across
// app/server/api/v1/*. Curated — not exhaustive; the DB column is
// varchar(100) and accepts any value.
export const AUDIT_LOG_RESOURCES = [
  'auth',
  'user',
  'role',
  'student',
  'parent',
  'teacher',
  'staff',
  'academic_session',
  'term',
  'class',
  'section',
  'subject',
  'class_subject',
  'teacher_assignment',
  'enrollment',
  'attendance_session',
  'assignment',
  'submission',
  'resource',
  'exam',
  'exam_result',
  'report_card',
  'fee_structure',
  'fee_item',
  'invoice',
  'payment',
  'receipt',
  'admission',
  'timetable_entry',
  'announcement',
  'notification',
  'message',
  'event',
  'gallery_album',
  'gallery_image',
] as const

// Overview counts (no pagination — single aggregate response).
export const overviewQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
})
export type OverviewQuery = z.infer<typeof overviewQuerySchema>

// Attendance operational report (per-class aggregate within scope).
// Distinct from `attendanceReportQuerySchema` in schedule.ts which is
// the per-student report (sessionId + classId both required).
export const attendanceOverviewReportQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
})
export type AttendanceOverviewReportQuery = z.infer<
  typeof attendanceOverviewReportQuerySchema
>

// Enrollments report (per class x status).
export const enrollmentReportQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  status: z
    .enum(['active', 'completed', 'promoted', 'repeated', 'withdrawn'])
    .optional(),
})
export type EnrollmentReportQuery = z.infer<typeof enrollmentReportQuerySchema>

// Audit log list (paginated, filterable).
export const auditLogListQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  resource: z.string().trim().max(100).optional(),
  userId: uuidSchema.optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
})
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>

// Supported export formats for report/list endpoints. Parsed at the
// route layer via parseFormat(); the export permission is enforced
// there for every non-JSON format.
export const exportFormatSchema = z.enum(['json', 'csv', 'xlsx'])
export type ExportFormat = z.infer<typeof exportFormatSchema>

// Admissions pipeline report (one count row per pipeline stage).
export const admissionsPipelineQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  intendedClassId: uuidSchema.optional(),
})
export type AdmissionsPipelineQuery = z.infer<
  typeof admissionsPipelineQuerySchema
>

// Audit certificate (non-paginated aggregate over the same filters as
// auditLogListQuerySchema; `search` is intentionally excluded so the
// certificate always reflects a well-defined filter window).
export const auditCertificateQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  resource: z.string().trim().max(100).optional(),
  userId: uuidSchema.optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
})
export type AuditCertificateQuery = z.infer<
  typeof auditCertificateQuerySchema
>

// ---------------------------------------------------------------------------
// Expanded financial reports (Phase 14D)
//
// School-wide staff-only aggregates (invoices issued / partially_paid
// / paid). Every breakdown shares the session/term/class filters that
// make sense for it.
// ---------------------------------------------------------------------------

export const financeFeePurposeReportQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
})
export type FinanceFeePurposeReportQuery = z.infer<
  typeof financeFeePurposeReportQuerySchema
>

export const financeByClassReportQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
})
export type FinanceByClassReportQuery = z.infer<
  typeof financeByClassReportQuerySchema
>

export const financeByTermReportQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
})
export type FinanceByTermReportQuery = z.infer<
  typeof financeByTermReportQuerySchema
>
