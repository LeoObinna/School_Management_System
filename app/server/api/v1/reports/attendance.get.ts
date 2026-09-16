/**
 * GET /api/v1/reports/attendance
 * JSON by default (reports.view); ?format=csv requires reports.export.
 * Returns one row per class with present/absent/late/excused counts
 * and an overall rate (NUMERIC string, 2 dp).
 */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceOverviewReportQuerySchema } from '~/shared/schemas'
import { getAttendanceReport } from '~/server/services/reports'

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'reports.view')
  const query = parseQueryData(
    attendanceOverviewReportQuerySchema,
    getQuery(event),
  )
  const format = String(getQuery(event).format ?? 'json')
  if (format === 'csv') {
    requirePermission(event, 'reports.export')
  }
  const data = await getAttendanceReport(query)

  if (format === 'csv') {
    const header = [
      'Class',
      'Present',
      'Absent',
      'Late',
      'Excused',
      'Total',
      'Rate (%)',
    ]
    const lines = data.map((r) =>
      [
        r.className,
        r.present,
        r.absent,
        r.late,
        r.excused,
        r.total,
        r.rate,
      ]
        .map(csvCell)
        .join(','),
    )
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'content-disposition',
      'attachment; filename="attendance-report.csv"',
    )
    return [header.join(','), ...lines].join('\n')
  }

  return { data }
})
