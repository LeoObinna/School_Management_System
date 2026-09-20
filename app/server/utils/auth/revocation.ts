/**
 * Server-side session revocation (Phase 13), backed by EDGE_KV.
 *
 * Sessions are cookie-only HMAC-signed tokens (stateless, see
 * tokens.ts). Revocation therefore uses two short-lived KV marker keys,
 * never the database:
 *
 *  - `sess:rev:<sid>` — marks ONE session revoked (logout). TTL is the
 *    longest session lifetime; the cookie itself expires sooner.
 *  - `sess:nb:<userId>` — marks every session issued BEFORE the stored
 *    unix epoch invalid (password reset). TTL is the longest session
 *    lifetime, after which all pre-reset sessions have expired anyway.
 *
 * Trade-off: KV propagates writes globally within roughly a minute, so
 * a freshly revoked cookie may be accepted for a few seconds at the
 * edge. If KV is bound but a lookup errors, the request is treated as
 * unauthenticated (fail closed); with no binding (Node dev) revocation
 * is inert just like before Phase 13.
 */
import type { H3Event } from 'h3'
import type { SessionClaims } from './tokens'
import { SESSION_TTL_SECONDS } from './tokens'
import { getEdgeKv } from './edge-kv'

/** Longest any revocation marker must outlive the newest valid cookie. */
const MARKER_TTL_SECONDS = SESSION_TTL_SECONDS.remember

function revokedKey(sessionId: string): string {
  return `sess:rev:${sessionId}`
}

function notBeforeKey(userId: string): string {
  return `sess:nb:${userId}`
}

/** Marks a single session id revoked until all cookies with it expire. */
export async function revokeSession(
  event: H3Event,
  sessionId: string,
): Promise<void> {
  const kv = getEdgeKv(event)
  if (!kv) {
    return
  }
  try {
    await kv.put(revokedKey(sessionId), '1', {
      expirationTtl: MARKER_TTL_SECONDS,
    })
  } catch (error) {
    console.error('[revocation] KV put (session) failed:', error)
  }
}

/**
 * Invalidates every EXISTING session for a user (password reset /
 * future "sign out everywhere"). Sessions issued from now on carry a
 * later `iat` and remain valid.
 */
export async function revokeAllSessions(
  event: H3Event,
  userId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  const kv = getEdgeKv(event)
  if (!kv) {
    return
  }
  try {
    await kv.put(notBeforeKey(userId), String(nowSeconds), {
      expirationTtl: MARKER_TTL_SECONDS,
    })
  } catch (error) {
    console.error('[revocation] KV put (user) failed:', error)
  }
}

/**
 * True when the session cookie must be rejected: its id was revoked
 * (logout), or it was issued before the user's last "revoke all".
 * Returns false when KV is not bound (Node dev). Throws-safe: callers
 * fail closed when this returns true; see loadAuthContext.
 */
export async function isSessionRevoked(
  event: H3Event,
  claims: Pick<SessionClaims, 'sid' | 'sub' | 'iat'>,
): Promise<boolean> {
  const kv = getEdgeKv(event)
  if (!kv) {
    return false
  }

  try {
    const [revoked, notBeforeRaw] = await Promise.all([
      kv.get(revokedKey(claims.sid), { type: 'text' }),
      kv.get(notBeforeKey(claims.sub), { type: 'text' }),
    ])

    if (revoked) {
      return true
    }
    if (typeof notBeforeRaw === 'string' && notBeforeRaw) {
      const notBefore = Number.parseInt(notBeforeRaw, 10)
      if (Number.isFinite(notBefore) && claims.iat < notBefore) {
        return true
      }
    }
    return false
  } catch (error) {
    console.error('[revocation] KV lookup failed; failing closed:', error)
    return true
  }
}
