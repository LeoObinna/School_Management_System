/**
 * Reports/audit API access layer (README §26/§27, Phase 11).
 * Centralized — pages never call $fetch directly.
 *
 * CSV downloads use the same endpoints with `?format=csv`; the helper
 * below builds a Blob URL and triggers a browser download.
 */
import { api, apiFetch } from './api'
import type {
  AdmissionsPipelineReport,
  AttendanceReportClassRow,
  AuditLogListItem,
  EnrollmentReportRow,
  OverviewReport,
  Paginated,
} from '~/shared/types'
import type {
  AdmissionsPipelineQuery,
  AttendanceOverviewReportQuery,
  AuditCertificateQuery,
  AuditLogListQuery,
  EnrollmentReportQuery,
  OverviewQuery,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const reportsApi = {
  overview: (params?: Partial<OverviewQuery>) =>
    api.get<OverviewReport>('/reports/overview', {
      params: params as Params,
    }),
  attendance: (params?: Partial<AttendanceOverviewReportQuery>) =>
    api.get<{ data: AttendanceReportClassRow[] }>('/reports/attendance', {
      params: params as Params,
    }),
  enrollments: (params?: Partial<EnrollmentReportQuery>) =>
    api.get<{ data: EnrollmentReportRow[] }>('/reports/enrollments', {
      params: params as Params,
    }),
  admissions: (params?: Partial<AdmissionsPipelineQuery>) =>
    api.get<AdmissionsPipelineReport>('/reports/admissions', {
      params: params as Params,
    }),
}

export const auditLogsApi = {
  list: (params?: Partial<AuditLogListQuery>) =>
    api.get<Paginated<AuditLogListItem>>('/audit-logs', {
      params: params as Params,
    }),
}

/**
 * Triggers a CSV download for the given report path. The endpoint
 * already enforces the export permission server-side.
 */
export async function downloadCsv(
  path: string,
  fileName: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  const config = useRuntimeConfig()
  const query = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue
      query.set(k, String(v))
    }
  }
  query.set('format', 'csv')
  const url = `${config.public.apiBaseUrl}${path}?${query.toString()}`
  // Use a direct window fetch so we can read credentials + the blob
  // without going through the typed api wrapper.
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${res.statusText}`)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

/**
 * Triggers a PDF download of the audit certificate attestation for the
 * given filter window. The endpoint always returns `application/pdf`
 * (no JSON form) and requires `audit_logs.view` + `reports.export`,
 * enforced server-side. Mirrors `downloadCsv` but skips the `format`
 * query param.
 */
export async function downloadAuditCertificate(
  fileName: string,
  params?: Partial<AuditCertificateQuery>,
): Promise<void> {
  const config = useRuntimeConfig()
  const query = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue
      query.set(k, String(v))
    }
  }
  const url = `${config.public.apiBaseUrl}/reports/audit-certificate?${query.toString()}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${res.statusText}`)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

// Re-export apiFetch so callers that need a raw typed call can use it.
export { apiFetch }
