import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { H3Event } from 'h3'
import { schema } from '../../database/schema'

/**
 * Central database connection.
 *
 * Two runtimes are supported:
 *
 * 1. Cloudflare Workers (staging/production and `wrangler dev`):
 *    PostgreSQL is reached through the HYPERDRIVE binding
 *    (`event.context.cloudflare.env.HYPERDRIVE.connectionString`).
 *
 *    The Workers runtime scopes socket I/O to the request that opened
 *    it, so a postgres.js connection CANNOT be cached across requests
 *    ("Cannot perform I/O on behalf of a different request"). Per
 *    Cloudflare's Hyperdrive guidance we therefore create a small
 *    (max: 1) client PER REQUEST; Hyperdrive itself maintains the
 *    pooled connections to PostgreSQL. The client is closed after the
 *    response is sent (server/plugins/cloudflare.ts).
 *
 * 2. Plain Node/Nuxt local dev (`nuxt dev`): no bindings exist; a
 *    process-wide pool is created lazily from runtimeConfig.databaseUrl
 *    / DATABASE_URL and reused.
 *
 * The exported `db` is a lazy forwarding proxy, so existing call sites
 * (`const { db } = await import('./db')`) keep working unchanged in both
 * runtimes without needing the H3 event at import time.
 */

const REQUEST_CLIENT = Symbol('sms-request-db')

/** Builds a connected Drizzle client. Type source for SmsDatabase. */
function buildDatabase(connectionString: string, max: number) {
  const sqlClient = postgres(connectionString, {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return drizzle(sqlClient, { schema })
}

/** Exact runtime Drizzle type (includes $client used by the health route). */
export type SmsDatabase = ReturnType<typeof buildDatabase>

// --- Plain Node dev: one process-wide client -------------------------------
let nodeInstance: SmsDatabase | null = null

/**
 * Creates (once per process) the Drizzle client for plain Node dev.
 * Retained for compatibility/explicit initialisation; safe to repeat.
 */
export function initDatabase(
  connectionString: string,
  options: { max?: number } = {},
): SmsDatabase {
  if (nodeInstance) {
    return nodeInstance
  }
  if (!connectionString) {
    throw new Error('initDatabase() requires a PostgreSQL connection string.')
  }
  nodeInstance = buildDatabase(connectionString, options.max ?? 10)
  return nodeInstance
}

/** Resolves the connection string outside Workers (local Node dev). */
function resolveLocalConnectionString(): string {
  let fromConfig = ''
  try {
    fromConfig = useRuntimeConfig().databaseUrl || ''
  } catch {
    // useRuntimeConfig is unavailable outside the Nuxt/Nitro context.
    fromConfig = ''
  }
  return fromConfig || process.env.DATABASE_URL || ''
}

interface RequestDbHolder {
  db: SmsDatabase
  sql: ReturnType<typeof postgres>
}

/** The current H3 event, or null when called outside a request. */
function currentEvent(): H3Event | null {
  try {
    // Nitro provides useEvent() per request via AsyncLocalStorage.
    return useEvent()
  } catch {
    return null
  }
}

/**
 * Returns (creating once) the per-request Drizzle client for a Worker
 * invocation backed by the Hyperdrive binding.
 */
function getRequestClient(event: H3Event): RequestDbHolder | null {
  const ctx = event.context as Record<symbol, unknown>
  const existing = ctx[REQUEST_CLIENT] as RequestDbHolder | undefined
  if (existing) {
    return existing
  }
  const env = (
    event.context as { cloudflare?: { env?: { HYPERDRIVE?: { connectionString?: string } } } }
  ).cloudflare?.env
  const connectionString = env?.HYPERDRIVE?.connectionString
  if (!connectionString) {
    return null
  }
  // Hyperdrive pools to PostgreSQL at the edge — one connection per
  // Worker request.
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
  })
  const db = drizzle(sql, { schema })
  const holder = { db, sql }
  ctx[REQUEST_CLIENT] = holder
  return holder
}

/**
 * Closes the per-request PostgreSQL client. Called from the Cloudflare
 * plugin after the response is sent. No-op outside Workers.
 */
export async function closeRequestDatabase(event: H3Event): Promise<void> {
  const holder = (event.context as Record<symbol, unknown>)[
    REQUEST_CLIENT
  ] as RequestDbHolder | undefined
  if (!holder) {
    return
  }
  delete (event.context as Record<symbol, unknown>)[REQUEST_CLIENT]
  try {
    await holder.sql.end({ timeout: 1 })
  } catch {
    // Best-effort cleanup; the runtime reaps request sockets anyway.
  }
}

function resolveDatabase(): SmsDatabase {
  // Workers: client is scoped to the current request.
  const event = currentEvent()
  if (event) {
    const holder = getRequestClient(event)
    if (holder) {
      return holder.db
    }
  }

  // Plain Node dev: process-wide pool from DATABASE_URL.
  const connectionString = resolveLocalConnectionString()
  if (!connectionString) {
    throw new Error(
      'Database is not configured: no HYPERDRIVE binding was initialised '
        + 'and DATABASE_URL is unset. In Workers, check the HYPERDRIVE '
        + 'binding in wrangler.toml; in local dev, set DATABASE_URL.',
    )
  }
  return initDatabase(connectionString, { max: 10 })
}

/**
 * Lazy Drizzle handle. Every property access forwards to the resolved
 * client — per-request under Workers, process-wide under Node dev.
 */
export const db: SmsDatabase = new Proxy({} as SmsDatabase, {
  get(_target, property, receiver) {
    const target = resolveDatabase() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(target, property, receiver)
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(target)
      : value
  },
})

export { schema }
export type Schema = typeof schema
