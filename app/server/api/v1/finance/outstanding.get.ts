/**
 * GET /api/v1/finance/outstanding
 * JSON by default; ?format=csv requires finance.export.
 */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { outstandingQuerySchema } from '~/shared/schemas'
import {
  getFinanceActor,
  listOutstanding,
} from '~/server/services/finance'

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(outstandingQuerySchema, getQuery(event))
  const format = String(getQuery(event).format ?? 'json')
  if (format === 'csv') {
    requirePermission(event, 'finance.export')
  }
  const actor = await getFinanceActor(auth)
  // Parents must target one of their own children (service enforces).
  const { data, total } = await listOutstanding(query, actor)

  if (format === 'csv') {
    const header = [
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
    const lines = data.map((r) =>
      [
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
      ]
        .map(csvCell)
        .join(','),
    )
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'content-disposition',
      'attachment; filename="outstanding.csv"',
    )
    return [header.join(','), ...lines].join('\n')
  }

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
})
