/**
 * Paystack webhook signature verification (Phase 15).
 *
 * Paystack signs every webhook POST with HMAC-SHA512 of the RAW request
 * body using the account secret key, delivered in the
 * `x-paystack-signature` header as lowercase hex. Web Crypto provides
 * HMAC in both the Workers runtime and Node ≥ 20 (vitest), so this
 * stays dependency-free. Comparison is timing-safe via the shared auth
 * encoding helper.
 */
import { timingSafeEqual, utf8ToBytes } from '../auth/encoding'

/** Lowercase-hex HMAC-SHA512 of `rawBody` keyed by `secret`. */
export async function computePaystackSignature(
  secret: string,
  rawBody: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, utf8ToBytes(rawBody))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * True only when `signature` matches the expected HMAC for `rawBody`.
 * Missing/empty inputs always fail closed.
 */
export async function verifyPaystackSignature(
  secret: string,
  rawBody: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature) return false
  const expected = await computePaystackSignature(secret, rawBody)
  const a = utf8ToBytes(expected)
  const b = utf8ToBytes(signature.trim().toLowerCase())
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
