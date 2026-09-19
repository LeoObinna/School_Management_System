/**
 * GET /api/v1/finance/outstanding
 * JSON by default; ?format=csv|xlsx requires finance.export.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { outstandingQuerySchema } from '~/shared/schemas'
import {
  getFinanceActor,
  listOutstanding,
} from '~/server/services/finance'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
  'Invoice',
  'Student',
  'Admission no',
  'Class',
  'Session',
  'Term',
  'Due date',
  'Total',
  'Paid',
  'Balance',
  'Overdue',
]

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(outstandingQuerySchema, getQuery(event))
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'finance.export')
  }
  const actor = await getFinanceActor(auth)
  // Parents must target one of their own children (service enforces).
  const { data, total } = await listOutstanding(query, actor)

  if (format === 'json') {
    return {
      data,
      meta: {
        currentPage: query.page,
        perPage: query.perPage,
        total,
        lastPage: Math.max(1, Math.ceil(total / query.perPage)),
      },
    }
  }

  const rows: ExportRow[] = data.map((r) => [
    r.invoiceNumber,
    r.studentName,
    r.admissionNumber,
    r.className ?? '',
    r.sessionName,
    r.termName ?? '',
    r.dueDate ?? '',
    r.total,
    r.amountPaid,
    r.balance,
    r.overdue ? 'yes' : 'no',
  ])

  if (format === 'csv') {
    return sendCsv(event, 'outstanding.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'outstanding.xlsx', HEADERS, rows)
})
