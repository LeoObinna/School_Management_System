/**
 * GET /api/v1/exams/:id
 * JSON exam detail by default (exams.view); ?format=xlsx exports the
 * recorded exam scores as a workbook and additionally requires
 * reports.export (cross-domain export slug, matching audit-logs).
 */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getExam,
  getExamScoresForExport,
} from '~/server/services/exams'
import {
  parseFormat,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'
import { smsSlugify } from '~/server/utils/slug'

const XLSX_HEADERS = [
  'Admission no',
  'Student',
  'Subject code',
  'Subject',
  'Max score',
  'Score',
  'Grade',
]

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exams.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const format = parseFormat(event)
  if (format === 'xlsx') {
    requirePermission(event, 'reports.export')
    const [exam, scoreRows] = await Promise.all([
      getExam(id),
      getExamScoresForExport(id),
    ])
    const rows: ExportRow[] = scoreRows.map((r) => [
      r.admissionNumber ?? '',
      r.studentName,
      r.subjectCode ?? '',
      r.subjectName,
      r.maxScore,
      r.score,
      r.grade ?? '',
    ])
    const slug = smsSlugify(exam.name) || id
    return sendWorkbook(event, `exam-scores-${slug}.xlsx`, XLSX_HEADERS, rows)
  }

  return getExam(id)
})
