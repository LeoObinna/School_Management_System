import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import type { HealthResponse } from '~/shared/types'

/**
 * GET /api/v1/health
 *
 * Simple health check. Verifies the app is running and (optionally)
 * that the database is reachable.
 */
export default defineEventHandler(async (): Promise<HealthResponse> => {
  let database = false
  try {
    // Lazy import to avoid loading the DB client on every health check
    // when the DB is unavailable.
    const { db } = await import('~/server/utils/db')
    // `execute(sql)` is supported by both the legacy PostgreSQL
    // Drizzle client and the D1/SQLite client (Phase 2 dual path).
    await db.execute(sql`SELECT 1`)
    database = true
  } catch {
    database = false
  }

  const status = database ? 'ok' : 'degraded'

  return {
    status,
    service: 'victorious-children-sms',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    database,
  }
})
