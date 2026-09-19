/**
 * GET /api/v1/reports/audit-certificate
 *
 * Streams a PDF attestation of audit-log activity for a filter window
 * (README §26, Phase 12 Part C Option B). Requires `audit_logs.view`
 * plus the export permission `reports.export`. The PDF is generated on
 * demand from live aggregates — nothing is persisted.
 */
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { auditCertificateQuerySchema } from '~/shared/schemas'
import { getAuditCertificateSummary } from '~/server/services/reports'
import { renderAuditCertificatePdf } from '~/server/utils/pdf/audit-certificate'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'audit_logs.view')
  requirePermission(event, 'reports.export')
  const query = parseQueryData(
    auditCertificateQuerySchema,
    getQuery(event),
  )

  const summary = await getAuditCertificateSummary(query)
  const generatedAt = new Date().toISOString()

  const pdf = await renderAuditCertificatePdf({
    generatedAt,
    generatedBy: {
      name: auth.user.name,
      email: auth.user.email,
    },
    summary,
  })

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(
    event,
    'content-disposition',
    `inline; filename="audit-certificate-${generatedAt.slice(0, 10)}.pdf"`,
  )
  return pdf
})
