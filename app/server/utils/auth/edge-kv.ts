/**
 * EDGE_KV binding resolver (Phase 13).
 *
 * A single Cloudflare KV namespace per environment backs:
 *  - the distributed sliding-window login/reset rate limiter
 *    (keys prefixed `rl:`), and
 *  - the server-side session revocation list (keys prefixed
 *    `sess:`).
 *
 * KV is non-authoritative operational state: the relational database
 * remains the source of truth, and no key here is ever trusted for
 * identity or authorization decisions beyond "blocked/revoked".
 *
 * The binding is absent in plain Node dev (`nuxt dev`) — callers must
 * tolerate `null` and fall back to their local behaviour. Under
 * `wrangler dev` the binding exists and is emulated on local disk.
 */
import type { H3Event } from 'h3'

/** Structural subset of the Cloudflare KVNamespace API the SMS uses. */
export interface EdgeKv {
  get(
    key: string,
    options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' },
  ): Promise<unknown>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

type CloudflareEnvCarrier = {
  cloudflare?: { env?: Record<string, unknown> }
}

/** Resolves EDGE_KV from a request event, or null when unbound. */
export function getEdgeKv(event: H3Event): EdgeKv | null {
  const env = (event.context as CloudflareEnvCarrier).cloudflare?.env
  return env && 'EDGE_KV' in env ? (env.EDGE_KV as EdgeKv) : null
}

/** Resolves EDGE_KV from a raw Workers env (queue/cron contexts). */
export function getEdgeKvFromEnv(env: unknown): EdgeKv | null {
  const record = (env ?? {}) as Record<string, unknown>
  return 'EDGE_KV' in record ? (record.EDGE_KV as EdgeKv) : null
}
