/**
 * Signed-token primitives backed by HMAC-SHA-256 (Web Crypto).
 *
 * Tokens are signed, never encrypted: they carry only non-sensitive
 * identifiers. Every token is bound to a `purpose` both inside its
 * claims and in the HMAC message, so a session token cannot be replayed
 * as a password-reset token and vice versa.
 *
 * Format:  <payloadBase64Url>.<signatureBase64Url>
 *
 * Sessions are cookie-only signed state (README §25 permits this); a
 * KV-backed session store can be added later for server-side
 * revocation without changing this token format.
 */
import {
  utf8ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  randomToken,
  timingSafeEqual,
} from './encoding'

export type TokenPurpose = 'session' | 'reset'

export interface BaseClaims {
  pur: TokenPurpose
  iat: number
  exp: number
}

export interface SessionClaims extends BaseClaims {
  pur: 'session'
  sub: string // user id
  sid: string // session id (rotation/CSRF binding)
  rem: boolean // remember me (informational)
}

export interface ResetClaims extends BaseClaims {
  pur: 'reset'
  sub: string // user id
  fp: string // password fingerprint — invalidated on password change
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    utf8ToBytes(message),
  )
  return new Uint8Array(signature)
}

interface SignOptions {
  purpose: TokenPurpose
  maxAgeSeconds: number
  now?: number
}

/** Creates a purpose-bound, expiring, HMAC-signed token. */
export async function signToken(
  secret: string,
  claims: Record<string, unknown>,
  options: SignOptions,
): Promise<string> {
  if (!secret) {
    throw new Error('A non-empty secret is required to sign tokens.')
  }
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const envelope = {
    ...claims,
    pur: options.purpose,
    iat: now,
    exp: now + options.maxAgeSeconds,
  }
  const payloadB64 = bytesToBase64Url(
    utf8ToBytes(JSON.stringify(envelope)),
  )
  const signature = await hmac(secret, `${options.purpose}.${payloadB64}`)
  return `${payloadB64}.${bytesToBase64Url(signature)}`
}

/**
 * Verifies a token's signature, purpose and expiry.
 * Returns the parsed claims, or null if invalid/expired/tampered.
 */
export async function verifyToken<P extends TokenPurpose>(
  secret: string,
  token: string,
  purpose: P,
  now?: number,
): Promise<(P extends 'session' ? SessionClaims : ResetClaims) | null> {
  if (!secret || !token) {
    return null
  }
  const separatorIndex = token.indexOf('.')
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null
  }
  const payloadB64 = token.slice(0, separatorIndex)

  let claims: BaseClaims
  let providedSignature: Uint8Array
  try {
    providedSignature = base64UrlToBytes(token.slice(separatorIndex + 1))
    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64))
    claims = JSON.parse(json) as BaseClaims
  } catch {
    return null
  }

  const expectedSignature = await hmac(secret, `${purpose}.${payloadB64}`)
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null
  }
  if (claims.pur !== purpose) {
    return null
  }
  const current = now ?? Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || current >= claims.exp) {
    return null
  }

  return claims as P extends 'session' ? SessionClaims : ResetClaims
}

export function newSessionId(): string {
  return randomToken(32).token
}

/**
 * Deterministic double-submit CSRF token for a session. The same value
 * is set in a readable cookie and must be echoed in the
 * `x-csrf-token` header on state-changing requests.
 */
export async function deriveCsrfToken(
  secret: string,
  sessionId: string,
): Promise<string> {
  return bytesToBase64Url(await hmac(secret, `csrf.${sessionId}`))
}

/** Session lifetimes (seconds). */
export const SESSION_TTL_SECONDS = {
  default: 60 * 60 * 24 * 7, // 7 days
  remember: 60 * 60 * 24 * 30, // 30 days
} as const

/** Password reset token lifetime (seconds) — 1 hour. */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60
