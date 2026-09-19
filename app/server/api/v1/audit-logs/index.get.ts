/**
 * GET /api/v1/audit-logs
 * JSON by default (audit_logs.view); ?format=csv|xlsx requires reports.export.
 * Paginated audit log viewer with filters: action, resource, userId,
 * dateFrom, dateTo, search. LEFT JOINs users for actor name/email.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { auditLogListQuerySchema } from '~/shared/schemas'
import { listAuditLogs } from '~/server/services/reports'
import {
  parseFormat,
  sendCsv,
  sendWorkbook,
  type ExportRow,
} from '~/server/utils/exports'

const HEADERS = [
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

function fmtDate(value: unknown): string {
  if (!value) return ''
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'audit_logs.view')
  const query = parseQueryData(auditLogListQuerySchema, getQuery(event))
  const format = parseFormat(event)
  if (format !== 'json') {
    requirePermission(event, 'reports.export')
  }
  const { data, meta } = await listAuditLogs(query)

  if (format === 'json') {
    return { data, meta }
  }

  const rows: ExportRow[] = data.map((r) => [
    fmtDate(r.createdAt),
    r.userName ?? '',
    r.userEmail ?? '',
    r.action,
    r.resource,
    r.resourceId ?? '',
    r.description ?? '',
    r.ipAddress ?? '',
    r.metadata == null ? '' : String(r.metadata),
  ])

  if (format === 'csv') {
    return sendCsv(event, 'audit-logs.csv', HEADERS, rows)
  }
  return sendWorkbook(event, 'audit-logs.xlsx', HEADERS, rows)
})
