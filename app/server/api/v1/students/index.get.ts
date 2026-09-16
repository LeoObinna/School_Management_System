/** GET /api/v1/students — JSON listing (students.view) or CSV export (students.export). */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { studentListQuerySchema } from '~/shared/schemas'
import { listStudents, listStudentsForExport } from '~/server/services/people'

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const query = parseQueryData(studentListQuerySchema, getQuery(event))
  const format = String(getQuery(event).format ?? 'json')
  if (format === 'csv') {
    requirePermission(event, 'students.export')
    const rows = await listStudentsForExport()
    const header = [
      'Admission no',
      'First name',
      'Last name',
      'Status',
      'Class',
      'Guardian name',
      'Guardian email',
      'Guardian phone',
    ]
    const lines = rows.map((r) =>
      [
        r.admissionNumber,
        r.firstName,
        r.lastName,
        r.status,
        r.className ?? '',
        r.guardianName ?? '',
        r.guardianEmail ?? '',
        r.guardianPhone ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'content-disposition',
      'attachment; filename="students.csv"',
    )
    return [header.join(','), ...lines].join('\n')
  }
  return listStudents(query)
})
