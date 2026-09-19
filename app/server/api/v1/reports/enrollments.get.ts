/**
 * GET /api/v1/reports/enrollments
 * JSON by default (reports.view); ?format=csv|xlsx requires reports.export.
 * Returns one row per (class, status) tuple with the live count.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { enrollmentReportQuerySchema } from '~/shared/schemas'
import { getEnrollmentReport } from '~/server/services/reports'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = ['Class', 'Status', 'Count']

export default defineEventHandler(async (event) => {
  requirePermission(event, 'reports.view')
  const query = parseQueryData(
    enrollmentReportQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'reports.export')
  }
  const data = await getEnrollmentReport(query)

  if (format === 'json') {
    return { data }
  }

  const rows: ExportRow[] = data.map((r) => [r.className, r.status, r.count])

  if (format === 'csv') {
    return sendCsv(event, 'enrollment-report.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'enrollment-report.xlsx', HEADERS, rows)
})
