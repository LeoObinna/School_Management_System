/**
 * GET /api/v1/audit-logs
 * JSON by default (audit_logs.view); ?format=csv requires reports.export.
 * Paginated audit log viewer with filters: action, resource, userId,
 * dateFrom, dateTo, search. LEFT JOINs users for actor name/email.
 */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { auditLogListQuerySchema } from '~/shared/schemas'
import { listAuditLogs } from '~/server/services/reports'

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function fmtDate(value: unknown): string {
  if (!value) return ''
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'audit_logs.view')
  const query = parseQueryData(auditLogListQuerySchema, getQuery(event))
  const format = String(getQuery(event).format ?? 'json')
  if (format === 'csv') {
    requirePermission(event, 'reports.export')
  }
  const { data, meta } = await listAuditLogs(query)

  if (format === 'csv') {
    const header = [
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Resource',
      'Resource ID',
      'Description',
      'IP address',
      'Metadata',
    ]
    const lines = data.map((r) =>
      [
        fmtDate(r.createdAt),
        r.userName ?? '',
        r.userEmail ?? '',
        r.action,
        r.resource,
        r.resourceId ?? '',
        r.description ?? '',
        r.ipAddress ?? '',
        r.metadata ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'content-disposition',
      'attachment; filename="audit-logs.csv"',
    )
    return [header.join(','), ...lines].join('\n')
  }

  return { data, meta }
})
