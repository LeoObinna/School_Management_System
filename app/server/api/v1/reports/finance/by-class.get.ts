/**
 * GET /api/v1/reports/finance/by-class
 *
 * Billed/collected/outstanding (kobo in JSON) broken down by the
 * student's ACTIVE enrollment class for each invoice's session;
 * students without one appear as "Unassigned". Staff-only (see
 * fee-purposes.get.ts for the permission rationale).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { financeByClassReportQuerySchema } from '~/shared/schemas'
import { getByClassReport } from '~/server/services/finance-reports'
import { koboToNaira } from '~/shared/utils/money'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Class',
  'Invoices',
  'Students',
  'Billed (NGN)',
  'Collected (NGN)',
  'Outstanding (NGN)',
]

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(
    financeByClassReportQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'finance.export')
  }
  const report = await getByClassReport(query, auth)

  if (format === 'json') {
    return { data: report }
  }

  const rows: ExportRow[] = report.data.map((r) => [
    r.className,
    r.invoiceCount,
    r.studentCount,
    koboToNaira(r.billed),
    koboToNaira(r.collected),
    koboToNaira(r.outstanding),
  ])

  if (format === 'csv') {
    return sendCsv(event, 'finance-by-class.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'finance-by-class.xlsx', HEADERS, rows)
})
