import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import { schema } from '../../database/schema'

/**
 * Central database connection.
 *
 * Phase 1 of the D1 migration (2026-09-22) declared the D1 binding `DB`
 * alongside the legacy HYPERDRIVE binding. Three runtimes are now
 * supported:
 *
 * 1. Cloudflare Workers (staging/production and `wrangler dev`) with
 *    PostgreSQL (Hyperdrive):
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
 * 2. Cloudflare Workers (future, after Phase 2 schema rewrite) with
 *    D1/SQLite: the D1 binding is reached through
 *    `event.context.cloudflare.env.DB`. D1 is binding-managed so
 *    there is NO socket to close; the per-request client is just a
 *    thin Drizzle wrapper. `useD1()` is the switch that flips dispatch
 *    from Hyperdrive to D1; it returns false throughout Phase 1 —
 *    staging still serves via Hyperdrive until D1 acceptance.
 *
 * 3. Plain Node/Nuxt local dev (`nuxt dev`): no bindings exist; a
 *    process-wide pool is created lazily from runtimeConfig.databaseUrl
 *    / DATABASE_URL and reused.
 *
 * The exported `db` is a lazy forwarding proxy, so existing call sites
 * (`const { db } = await import('./db')`) keep working unchanged in
 * every runtime without needing the H3 event at import time.
 */

const REQUEST_CLIENT = Symbol('sms-request-db')
const REQUEST_D1_CLIENT = Symbol('sms-request-d1-db')

// ---------------------------------------------------------------------------
// Structural surface of the Cloudflare D1 binding so the app does not
// depend on @cloudflare/workers-types at build time. Matches the slice
// drizzle-orm/d1 actually calls (prepare + bind + first/run/all + batch
// + exec). Cf. notifications-queue.ts for the same structural-typing
// pattern applied to the Queue producer.
// ---------------------------------------------------------------------------
export interface D1Result {
  results?: unknown[]
  success?: boolean
  meta?: unknown
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all(): Promise<D1Result>
  run<T = unknown>(): Promise<T>
  first<T = unknown>(col?: string): Promise<T>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: { statement: string; params?: unknown[] }[]): Promise<D1Result[]>
  exec(query: string): Promise<unknown>
}

/** Builds a connected Drizzle client over PostgreSQL. */
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

/** Exact runtime Drizzle type for the D1 path. */
export type SmsD1Database = ReturnType<typeof drizzleD1>

export interface WorkerDatabase {
  db: SmsDatabase
  sql: ReturnType<typeof postgres>
}

export interface WorkerD1Database {
  db: SmsD1Database
  d1: D1Database
}

/**
 * Builds a short-lived Drizzle client for a Worker invocation that is
 * NOT a fetch request — e.g. a Cloudflare Queue consumer
 * (`cloudflare:queue` hook) where no H3 event/request-scoped client
 * exists. Uses the same single-connection settings as the request path
 * (Hyperdrive owns upstream pooling); the caller MUST close it with
 * `sql.end()` once the batch is handled.
 */
export function createWorkerDatabase(connectionString: string): WorkerDatabase {
  if (!connectionString) {
    throw new Error(
      'createWorkerDatabase() requires a HYPERDRIVE connection string.',
    )
  }
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
  })
  const db = drizzle(sql, { schema })
  return { db, sql }
}

/**
 * D1 sibling of {@link createWorkerDatabase}. Wraps the Cloudflare D1
 * binding in a Drizzle client for queue consumers / cron tasks that
 * run outside a fetch request. There is NO socket to close — D1 is
 * binding-managed — so callers do not need a finally block.
 *
 * Inert until Phase 2 (schema rewrite) — current schema uses PG types
 * (pgEnum/pgTable/NUMERIC) that drizzle-orm/d1 cannot read.
 */
export function createWorkerD1Database(d1: D1Database): WorkerD1Database {
  if (!d1 || typeof d1.prepare !== 'function') {
    throw new Error(
      'createWorkerD1Database() requires a D1 binding (env.DB).',
    )
  }
  const db = drizzleD1(d1 as never, { schema })
  return { db, d1 }
}

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

interface RequestD1DbHolder {
  db: SmsD1Database
  d1: D1Database
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
 * Returns (creating once) the per-request Drizzle client for a Worker
 * invocation backed by the D1 binding. No-op cleanup is needed — D1
 * is binding-managed. Inert until {@link useD1} flips to true in
 * Phase 2.
 */
function getRequestD1Client(event: H3Event): RequestD1DbHolder | null {
  const ctx = event.context as Record<symbol, unknown>
  const existing = ctx[REQUEST_D1_CLIENT] as RequestD1DbHolder | undefined
  if (existing) {
    return existing
  }
  const env = (
    event.context as { cloudflare?: { env?: { DB?: D1Database } } }
  ).cloudflare?.env
  const d1 = env?.DB
  if (!d1 || typeof d1.prepare !== 'function') {
    return null
  }
  const db = drizzleD1(d1 as never, { schema })
  const holder = { db, d1 }
  ctx[REQUEST_D1_CLIENT] = holder
  return holder
}

/**
 * Closes the per-request PostgreSQL client. Called from the Cloudflare
 * plugin after the response is sent. No-op outside Workers and no-op
 * when the request used the D1 path (D1 is binding-managed, no socket).
 */
export async function closeRequestDatabase(event: H3Event): Promise<void> {
  const ctx = event.context as Record<symbol, unknown>
  const d1Holder = ctx[REQUEST_D1_CLIENT] as RequestD1DbHolder | undefined
  if (d1Holder) {
    // D1 has no socket — just drop the holder.
    delete ctx[REQUEST_D1_CLIENT]
    return
  }
  const holder = ctx[REQUEST_CLIENT] as RequestDbHolder | undefined
  if (!holder) {
    return
  }
  delete ctx[REQUEST_CLIENT]
  try {
    await holder.sql.end({ timeout: 1 })
  } catch {
    // Best-effort cleanup; the runtime reaps request sockets anyway.
  }
}

/**
 * Dispatch switch between Hyperdrive (current default) and D1 (future).
 *
 * Phase 1: ALWAYS returns false — staging still serves traffic via
 * Hyperdrive. The flag is read by {@link resolveDatabase} so the
 * dispatch decision lives in one place.
 *
 * Phase 2 will flip this to true once the schema is rewritten to
 * SQLite/D1 and the query dialect migration (ilike → LIKE, interactive
 * transactions → D1 batch, PG raw-SQL fragments rewritten) is complete.
 *
 * The flip mechanism is env-var driven so staging can be A/B tested
 * without redeploy: set `SMS_USE_D1=true` via
 * `wrangler secret put SMS_USE_D1 -e staging` to opt a single deploy
 * into D1, leave it unset to stay on Hyperdrive.
 */
function useD1(): boolean {
  // Workers: env is on event.context.cloudflare.env (resolved in the
  // caller). Node dev: process.env. Read both.
  try {
    const event = currentEvent()
    if (event) {
      const env = (
        event.context as { cloudflare?: { env?: { SMS_USE_D1?: string | boolean } } }
      ).cloudflare?.env
      const raw = env?.SMS_USE_D1
      if (raw !== undefined) {
        return raw === true || String(raw) === 'true'
      }
    }
  } catch {
    // ignore — fall through to process.env
  }
  return process.env.SMS_USE_D1 === 'true'
}

function resolveDatabase(): SmsDatabase | SmsD1Database {
  // Workers: client is scoped to the current request.
  const event = currentEvent()
  if (event) {
    if (useD1()) {
      const d1Holder = getRequestD1Client(event)
      if (d1Holder) {
        return d1Holder.db
      }
      // Fall through to Hyperdrive if D1 dispatch was requested but
      // env.DB is missing — surfaces a clear configuration error below.
    }
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
 * client — per-request under Workers (D1 or Hyperdrive, dispatched by
 * {@link useD1}), process-wide under Node dev.
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
