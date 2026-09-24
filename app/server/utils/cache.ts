/**
 * Edge KV read-through cache (TRD §12 + §16).
 *
 * KV is non-authoritative: the D1 relational database remains the source
 * of truth, and a cache miss transparently falls through to the loader.
 * Caches are short-lived and best-effort — a stale or absent value is
 * always recoverable from the database.
 *
 * Keys are prefixed `cache:` to namespace away from the rate-limit
 * (`rl:`) and session-revocation (`sess:`) prefixes managed by
 * `auth/throttle.ts` and `auth/revocation.ts`.
 *
 * The EDGE_KV binding is absent in plain Node dev (`nuxt dev`); callers
 * receive the loader's value directly with no caching. Under
 * `wrangler dev` the binding exists and is emulated on local disk.
 */
import type { H3Event } from 'h3'
import { getEdgeKv } from './auth/edge-kv'

/** Namespace prefix for application cache keys. */
export const CACHE_PREFIX = 'cache:'

/** Composes a namespaced cache key from logical parts. */
export function cacheKey(...parts: string[]): string {
  return CACHE_PREFIX + parts.join(':')
}

/**
 * Read-through cache. Returns the cached value when present, otherwise
 * calls `loader`, persists the JSON-serialised result with the given
 * `ttlSeconds`, and returns it. KV is non-authoritative: any read or
 * write error is swallowed and the loader result returned directly.
 *
 * TTL must be >= 60s (Cloudflare KV minimum `expirationTtl`).
 */
export async function getOrSet<T>(
  event: H3Event,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const kv = getEdgeKv(event)
  if (kv) {
    try {
      const raw = await kv.get(key, { type: 'json' })
      if (raw !== null && raw !== undefined) {
        return raw as T
      }
    } catch (error) {
      console.error(`[cache] KV get failed for ${key}:`, error)
    }
  }

  const value = await loader()
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(value), {
        expirationTtl: Math.max(60, ttlSeconds),
      })
    } catch (error) {
      console.error(`[cache] KV put failed for ${key}:`, error)
    }
  }
  return value
}

/** Best-effort delete of a single cache key. Noop when KV is unbound. */
export async function invalidate(
  event: H3Event,
  key: string,
): Promise<void> {
  const kv = getEdgeKv(event)
  if (!kv) return
  try {
    await kv.delete(key)
  } catch (error) {
    console.error(`[cache] KV delete failed for ${key}:`, error)
  }
}

/**
 * Best-effort delete of multiple cache keys. An empty list is a no-op.
 * Failures of individual deletes are swallowed so a partial KV outage
 * does not abort an otherwise-valid write.
 */
export async function invalidateMany(
  event: H3Event,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return
  const kv = getEdgeKv(event)
  if (!kv) return
  await Promise.all(
    keys.map((key) =>
      kv.delete(key).catch((error: unknown) => {
        console.error(`[cache] KV delete failed for ${key}:`, error)
      }),
    ),
  )
}
