/**
 * Byte/string encoding helpers backed by Web Crypto-compatible globals.
 *
 * Pure and runtime-agnostic (Cloudflare Workers, Node 18+, browsers).
 */

export function utf8ToBytes(value: string) {
  const encoded = new TextEncoder().encode(value)
  // Copy into a fresh ArrayBuffer-backed view (TextEncoder types the
  // buffer as ArrayBufferLike, which Web Crypto rejects under TS 6).
  const bytes = new Uint8Array(encoded.length)
  bytes.set(encoded)
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value: string) {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Crypto-strength random token as base64url (used for salt / session id). */
export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)
  return { token: bytesToBase64Url(bytes), bytes }
}

/**
 * Constant-time byte comparison. Returns false up front for length
 * mismatch but does not short-circuit across the compared bytes.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let mismatch = a.length === b.length ? 0 : 1
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return mismatch === 0
}
