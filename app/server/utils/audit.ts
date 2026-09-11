/**
 * Audit logging helper (README §26).
 *
 * Records security/sensitive events into `audit_logs`. Failures are
 * swallowed so auditing can never break the primary request path.
 * Passwords, tokens and secrets are never logged: callers pass only
 * safe fields, and {@link safeMetadata} additionally strips sensitive
 * keys as a defence in depth.
 */
import type { H3Event } from 'h3'
import { getRequestHeader, getRequestIP } from 'h3'
import { auditLogs } from '../../database/schema'

const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|api[_-]?key/i

function safeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) {
    return null
  }
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    cleaned[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : value
  }
  return JSON.stringify(cleaned)
}

export interface AuditEntry {
  userId?: string | null
  action: string
  resource: string
  resourceId?: string | null
  description?: string | null
  metadata?: Record<string, unknown>
}

export async function writeAudit(
  event: H3Event,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { db } = await import('./db')
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      description: entry.description ?? null,
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? null,
      userAgent: getRequestHeader(event, 'user-agent') ?? null,
      metadata: safeMetadata(entry.metadata),
    })
  } catch {
    // Auditing failures must not interrupt the request.
  }
}
