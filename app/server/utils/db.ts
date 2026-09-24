import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import { schema } from '../../database/schema'

/**
 * Central database connection — Cloudflare D1 (SQLite) only.
 *
 * Every query uses the SQLite dialect (LIKE, `db.batch()`, SQLite
 * raw-SQL fragments). Two runtimes:
 *
 * 1. Cloudflare Workers (staging/production, `wrangler dev`, queue
 *    consumers and cron triggers): the D1 binding is reached through
 *    `event.context.cloudflare.env.DB` (fetch requests) or the env
 *    handed to the `cloudflare:queue` hook / scheduled task. D1 is
 *    binding-managed — there is NO socket to open or close.
 *
 * 2. Plain Node/Nuxt local dev (`nuxt dev`): no bindings exist, so a
 *    process-wide Drizzle/D1 client is created ONCE at Nitro startup
 *    (server/plugins/cloudflare.ts) via wrangler's
 *    `getPlatformProxy({ persist: true })` — the same Miniflare-backed
 *    local D1 the migrator and seeder use
 *    (`.wrangler/state/v3/d1/`). The proxy is disposed when Nitro
 *    closes.
 *
 * The exported `db` is a lazy forwarding proxy, so existing call sites
 * (`const { db } = await import('./db')`) keep working unchanged in
 * both runtimes without needing the H3 event at import time.
 */

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

/** Runtime Drizzle type for the D1 client (schema-bound). */
export type SmsD1Database = DrizzleD1Database<Schema>

/**
 * Canonical application Drizzle client type used by service code —
 * exactly the schema-bound D1 client since Phase 3 (the temporary
 * transaction/execute compatibility shims were removed with the query
 * dialect migration).
 */
export type AppDatabase = SmsD1Database

export interface WorkerD1Database {
  db: SmsD1Database
  d1: D1Database
}

/**
 * Wraps the Cloudflare D1 binding in a Drizzle client for queue
 * consumers / cron tasks that run outside a fetch request. D1 is
 * binding-managed, so there is nothing for callers to close.
 */
export function createWorkerD1Database(d1: D1Database): WorkerD1Database {
  if (!d1 || typeof d1.prepare !== 'function') {
    throw new Error(
      'createWorkerD1Database() requires a D1 binding (env.DB).',
    )
  }
  const db = drizzle(d1 as never, { schema })
  return { db, d1 }
}

// --- Plain Node dev: one process-wide client, via platform proxy ------------
interface PlatformProxyLike {
  env: { DB?: D1Database }
  dispose(): Promise<unknown>
}

let nodeDatabase: SmsD1Database | null = null
let nodeProxy: PlatformProxyLike | null = null
let nodeInit: Promise<SmsD1Database> | null = null

/**
 * Creates (once per process) the Drizzle/D1 client for plain Node dev
 * by attaching to wrangler's local platform proxy. Called from the
 * Cloudflare Nitro plugin at startup; safe to call repeatedly.
 */
export function initNodeDatabase(): Promise<SmsD1Database> {
  if (nodeDatabase) return Promise.resolve(nodeDatabase)
  if (!nodeInit) {
    nodeInit = (async () => {
      // Node-only path. The specifier is intentionally assembled at
      // runtime (char codes) and annotated with @vite-ignore so neither
      // Rollup/Nitro nor wrangler's esbuild pass can fold it into a
      // literal import and drag wrangler's CLI into the Worker bundle
      // (Nitro auto-externalizes devDependencies; a plain string
      // constant is inlined). This branch never executes in the workerd
      // runtime — the startup plugin guards on
      // navigator.userAgent === 'Cloudflare-Workers'.
      const wranglerModuleId = String.fromCharCode(
        119, 114, 97, 110, 103, 108, 101, 114,
      )
      const { getPlatformProxy } = await import(
        /* @vite-ignore */ wranglerModuleId
      )
      const proxy = (await getPlatformProxy({
        configPath: './wrangler.toml',
        persist: true,
      })) as PlatformProxyLike
      if (!proxy.env.DB || typeof proxy.env.DB.prepare !== 'function') {
        throw new Error(
          'Local D1 binding DB is unavailable. Is [[d1_databases]] DB '
          + 'declared in wrangler.toml and the migration applied '
          + '("npm run db:d1:migrate")?',
        )
      }
      nodeProxy = proxy
      nodeDatabase = drizzle(proxy.env.DB as never, { schema })
      return nodeDatabase
    })()
  }
  return nodeInit
}

/** Disposes the local platform proxy (Nitro close / dev restart). */
export async function closeNodeDatabase(): Promise<void> {
  if (!nodeProxy) return
  const proxy = nodeProxy
  nodeProxy = null
  nodeDatabase = null
  nodeInit = null
  try {
    await proxy.dispose()
  } catch {
    // Best-effort shutdown cleanup.
  }
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
 * fetch invocation backed by the D1 binding. D1 is binding-managed, so
 * the holder only avoids rebuilding the thin Drizzle wrapper.
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
  const db = drizzle(d1 as never, { schema })
  const holder = { db, d1 }
  ctx[REQUEST_D1_CLIENT] = holder
  return holder
}

/**
 * Drops the per-request client holder. Called from the Cloudflare
 * plugin after the response is sent. D1 has no socket, so this is just
 * context cleanup; no-op in plain Node dev (process-wide client).
 */
export async function closeRequestDatabase(event: H3Event): Promise<void> {
  const ctx = event.context as Record<symbol, unknown>
  delete ctx[REQUEST_D1_CLIENT]
}

function resolveDatabase(): SmsD1Database {
  // Workers fetch: per-request client from the D1 binding.
  const event = currentEvent()
  if (event) {
    const holder = getRequestD1Client(event)
    if (holder) {
      return holder.db
    }
  }

  // Plain Node dev: the Nitro startup plugin pre-warms this.
  if (nodeDatabase) {
    return nodeDatabase
  }

  throw new Error(
    'Database is not initialised: no D1 binding (env.DB) was found on '
    + 'the request context and the local Node dev client has not been '
    + 'started. Run "npm run dev" (the Cloudflare plugin attaches the '
    + 'local D1 platform proxy) or check the DB binding in wrangler.toml.',
  )
}

/**
 * Lazy Drizzle handle. Every property access forwards to the resolved
 * D1 client — per-request under Workers, process-wide under Node dev.
 */
export const db: AppDatabase = new Proxy({} as AppDatabase, {
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
