/**
 * GET /api/v1/students — JSON listing (students.view) or
 * CSV/XLSX directory export (students.export).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { studentListQuerySchema } from '~/shared/schemas'
import { listStudents, listStudentsForExport } from '~/server/services/people'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Admission no',
  'First name',
  'Last name',
  'Status',
  'Class',
  'Guardian name',
  'Guardian email',
  'Guardian phone',
]

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const query = parseQueryData(studentListQuerySchema, getQuery(event))
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'students.export')
  }

  if (format === 'json') {
    return listStudents(query)
  }

  const exportRows = await listStudentsForExport()
  const rows: ExportRow[] = exportRows.map((r) => [
    r.admissionNumber,
    r.firstName,
    r.lastName,
    r.status,
    r.className ?? '',
    r.guardianName ?? '',
    r.guardianEmail ?? '',
    r.guardianPhone ?? '',
  ])

  if (format === 'csv') {
    return sendCsv(event, 'students.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'students.xlsx', HEADERS, rows)
})
