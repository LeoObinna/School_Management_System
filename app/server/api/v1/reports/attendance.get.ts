/**
 * GET /api/v1/reports/attendance
 * JSON by default (reports.view); ?format=csv|xlsx requires reports.export.
 * Returns one row per class with present/absent/late/excused counts
 * and an overall rate (NUMERIC string, 2 dp).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceOverviewReportQuerySchema } from '~/shared/schemas'
import { getAttendanceReport } from '~/server/services/reports'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Class',
  'Present',
  'Absent',
  'Late',
  'Excused',
  'Total',
  'Rate (%)',
]

export default defineEventHandler(async (event) => {
  requirePermission(event, 'reports.view')
  const query = parseQueryData(
    attendanceOverviewReportQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'reports.export')
  }
  const data = await getAttendanceReport(query)

  if (format === 'json') {
    return { data }
  }

  const rows: ExportRow[] = data.map((r) => [
    r.className,
    r.present,
    r.absent,
    r.late,
    r.excused,
    r.total,
    r.rate,
  ])

  if (format === 'csv') {
    return sendCsv(event, 'attendance-report.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'attendance-report.xlsx', HEADERS, rows)
})
