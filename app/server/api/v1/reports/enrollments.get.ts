/**
 * GET /api/v1/reports/enrollments
 * JSON by default (reports.view); ?format=csv requires reports.export.
 * Returns one row per (class, status) tuple with the live count.
 */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { enrollmentReportQuerySchema } from '~/shared/schemas'
import { getEnrollmentReport } from '~/server/services/reports'

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'reports.view')
  const query = parseQueryData(
    enrollmentReportQuerySchema,
    getQuery(event),
  )
  const format = String(getQuery(event).format ?? 'json')
  if (format === 'csv') {
    requirePermission(event, 'reports.export')
  }
  const data = await getEnrollmentReport(query)

  if (format === 'csv') {
    const header = ['Class', 'Status', 'Count']
    const lines = data.map((r) =>
      [r.className, r.status, r.count].map(csvCell).join(','),
    )
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'content-disposition',
      'attachment; filename="enrollment-report.csv"',
    )
    return [header.join(','), ...lines].join('\n')
  }

  return { data }
})
