/**
 * GET /api/v1/reports/finance/fee-purposes
 *
 * Billed/collected/outstanding (kobo in JSON) broken down by fee
 * purpose (linked fee-item name, else invoice line description).
 *
 * School-wide financial data: JSON requires invoices.view AND a staff
 * finance actor (parents hold invoices.view for their own children but
 * are rejected by the service); csv/xlsx require finance.export.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { financeFeePurposeReportQuerySchema } from '~/shared/schemas'
import { getFeePurposeReport } from '~/server/services/finance-reports'
import { koboToNaira } from '~/shared/utils/money'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Fee purpose',
  'Lines',
  'Invoices',
  'Billed (NGN)',
  'Collected (NGN)',
  'Outstanding (NGN)',
]

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(
    financeFeePurposeReportQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'finance.export')
  }
  const report = await getFeePurposeReport(query, auth)

  if (format === 'json') {
    return { data: report }
  }

  const rows: ExportRow[] = report.data.map((r) => [
    r.purpose,
    r.lineCount,
    r.invoiceCount,
    koboToNaira(r.billed),
    koboToNaira(r.collected),
    koboToNaira(r.outstanding),
  ])

  if (format === 'csv') {
    return sendCsv(event, 'finance-by-fee-purpose.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'finance-by-fee-purpose.xlsx', HEADERS, rows)
})
