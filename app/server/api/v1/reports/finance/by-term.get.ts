/**
 * GET /api/v1/reports/finance/by-term
 *
 * Billed/collected/outstanding (kobo in JSON) broken down by invoice
 * term; invoices without a term appear as "Unassigned term".
 * Staff-only (see fee-purposes.get.ts for the permission rationale).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { financeByTermReportQuerySchema } from '~/shared/schemas'
import { getByTermReport } from '~/server/services/finance-reports'
import { koboToNaira } from '~/shared/utils/money'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Term',
  'Invoices',
  'Students',
  'Billed (NGN)',
  'Collected (NGN)',
  'Outstanding (NGN)',
]

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(
    financeByTermReportQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'finance.export')
  }
  const report = await getByTermReport(query, auth)

  if (format === 'json') {
    return { data: report }
  }

  const rows: ExportRow[] = report.data.map((r) => [
    r.termName,
    r.invoiceCount,
    r.studentCount,
    koboToNaira(r.billed),
    koboToNaira(r.collected),
    koboToNaira(r.outstanding),
  ])

  if (format === 'csv') {
    return sendCsv(event, 'finance-by-term.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'finance-by-term.xlsx', HEADERS, rows)
})
