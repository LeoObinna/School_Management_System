import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { schema } from '../../database/schema'

/**
 * Central database connection.
 *
 * Two runtimes are supported:
 *
 * 1. Cloudflare Workers (staging/production and `wrangler dev`):
 *    PostgreSQL is reached through the HYPERDRIVE binding. The Nitro
 *    request plugin (server/plugins/cloudflare.ts) calls initDatabase()
 *    with `env.HYPERDRIVE.connectionString` before any handler runs.
 *    Hyperdrive pools at the edge, so the Worker opens at most one
 *    connection per isolate (max: 1).
 *
 * 2. Plain Node/Nuxt local dev (`nuxt dev`): no bindings exist; the
 *    connection string comes from runtimeConfig.databaseUrl / DATABASE_URL
 *    and a small local pool is created lazily on first query.
 *
 * The exported `db` is a lazy forwarding proxy, so existing call sites
 * (`const { db } = await import('./db')`) keep working unchanged in both
 * runtimes without needing the H3 event at import time.
 */

/** Builds a connected Drizzle client. Type source for SmsDatabase. */
function buildDatabase(connectionString: string, max: number) {
  sqlClient = postgres(connectionString, {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return drizzle(sqlClient, { schema })
}

/** Exact runtime Drizzle type (includes $client used by the health route). */
export type SmsDatabase = ReturnType<typeof buildDatabase>

let instance: SmsDatabase | null = null
let sqlClient: ReturnType<typeof postgres> | null = null

/**
 * Creates (once per isolate/process) the Drizzle client for the given
 * connection string. Safe to call repeatedly — the first call wins.
 */
export function initDatabase(
  connectionString: string,
  options: { max?: number } = {},
): SmsDatabase {
  if (instance) {
    return instance
  }
  if (!connectionString) {
    throw new Error('initDatabase() requires a PostgreSQL connection string.')
  }
  instance = buildDatabase(connectionString, options.max ?? 1)
  return instance
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

function resolveDatabase(): SmsDatabase {
  if (instance) {
    return instance
  }
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
 * client, which is created on first use either by the Hyperdrive plugin
 * or from DATABASE_URL.
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
