/**
 * GET /api/v1/reports/admissions — admissions pipeline counts
 * (README §27, Phase 12 Part C Option B).
 *
 * JSON by default (admissions.view); ?format=csv|xlsx additionally
 * requires reports.export. Returns one row per pipeline stage in
 * workflow order (zero-count stages included) plus the overall total,
 * optionally filtered by sessionId / intendedClassId.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { admissionsPipelineQuerySchema } from '~/shared/schemas'
import { getAdmissionsPipeline } from '~/server/services/reports'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = ['Stage', 'Count']

// Human-friendly labels for the raw pipeline status slugs.
function stageLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admissions.view')
  const query = parseQueryData(
    admissionsPipelineQuerySchema,
    getQuery(event),
  )
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'reports.export')
  }
  const report = await getAdmissionsPipeline(query)

  if (format === 'json') {
    return report
  }

  const rows: ExportRow[] = report.data.map((r) => [
    stageLabel(r.status),
    r.count,
  ])
  // Trailing total row for spreadsheet consumers.
  rows.push(['Total', report.total])

  if (format === 'csv') {
    return sendCsv(event, 'admissions-pipeline.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'admissions-pipeline.xlsx', HEADERS, rows)
})
