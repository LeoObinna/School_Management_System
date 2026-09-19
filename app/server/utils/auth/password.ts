/**
 * Password hashing using PBKDF2-HMAC-SHA-512 via the Web Crypto API.
 *
 * Why PBKDF2 rather than argon2/bcrypt: Web Crypto is natively available
 * in the Cloudflare Workers runtime (no native/WASM dependency) and in
 * Node 18+, so the exact same implementation runs in production, in the
 * database seeder and in tests. The stored format carries its algorithm
 * and parameters, so a stronger KDF (e.g. argon2 via WASM) can be
 * introduced later and verified transparently by {@link verifyPassword}.
 *
 * Stored format:
 *   pbkdf2$<digest>$<iterations>$<saltBase64Url>$<hashBase64Url>
 */
import {
  utf8ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  randomToken,
  timingSafeEqual,
} from './encoding'

const ALGORITHM = 'PBKDF2'
const DIGEST = 'SHA-512'
// Cloudflare Workers caps WebCrypto PBKDF2 at 100,000 iterations: a
// higher deriveBits count throws in the deployed runtime ("iteration
// counts above 100000 are not supported"), which verifyPassword would
// swallow as a failed login and hashPassword as a 500. Plain Node dev
// and local workerd do not enforce the cap, so this MUST stay at or
// below 100,000 — a stronger KDF (argon2 via WASM) can be introduced
// later and verified transparently thanks to the parameterised format.
const ITERATIONS = 100_000
const KEY_BYTES = 64
const SALT_BYTES = 16
const PREFIX = 'pbkdf2'

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle
}

export async function hashPassword(password: string): Promise<string> {
  const salt = base64UrlToBytes(randomToken(SALT_BYTES).token)
  const baseKey = await subtle().importKey(
    'raw',
    utf8ToBytes(password),
    { name: ALGORITHM },
    false,
    ['deriveBits'],
  )
  const bits = await subtle().deriveBits(
    {
      name: ALGORITHM,
      salt,
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    baseKey,
    KEY_BYTES * 8,
  )
  return [
    PREFIX,
    DIGEST.toLowerCase().replace('-', ''),
    String(ITERATIONS),
    bytesToBase64Url(salt),
    bytesToBase64Url(new Uint8Array(bits)),
  ].join('$')
}

/**
 * Verifies a plaintext password against a stored encoded hash.
 * Returns false (never throws) for malformed/unsupported hashes so a
 * bad row cannot crash the login path.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 5 || parts[0] !== PREFIX) {
    return false
  }
  const digestTag = parts[1]
  const iterationsRaw = parts[2]
  const saltB64 = parts[3]
  const expectedB64 = parts[4]
  if (!digestTag || !iterationsRaw || !saltB64 || !expectedB64) {
    return false
  }
  if (digestTag !== 'sha512') {
    return false
  }
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false
  }

  const salt = base64UrlToBytes(saltB64)
  const expected = base64UrlToBytes(expectedB64)

  try {
    const baseKey = await subtle().importKey(
      'raw',
      utf8ToBytes(password),
      { name: ALGORITHM },
      false,
      ['deriveBits'],
    )
    const bits = await subtle().deriveBits(
      { name: ALGORITHM, salt, iterations, hash: DIGEST },
      baseKey,
      expected.length * 8,
    )
    return timingSafeEqual(new Uint8Array(bits), expected)
  } catch {
    return false
  }
}

/**
 * Stable, non-reversible fingerprint of a stored password hash. Used to
 * invalidate outstanding password-reset tokens once the password changes.
 */
export async function passwordFingerprint(storedHash: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', utf8ToBytes(storedHash))
  return bytesToBase64Url(new Uint8Array(digest).slice(0, 16))
}
