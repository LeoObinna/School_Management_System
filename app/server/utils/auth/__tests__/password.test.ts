import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  passwordFingerprint,
} from '../password'

describe('password hashing (PBKDF2)', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('produces a unique salted hash each time', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same-password', a)).toBe(true)
    expect(await verifyPassword('same-password', b)).toBe(true)
  })

  it('uses the encoded pbkdf2/sha512 format with parameters', async () => {
    const hash = await hashPassword('secret123')
    const [scheme, digest, iterations] = hash.split('$')
    expect(scheme).toBe('pbkdf2')
    expect(digest).toBe('sha512')
    expect(Number(iterations)).toBeGreaterThan(100_000)
  })

  it('returns false for malformed or unsupported hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'argon2$x$y$z$w')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$sha256$1$aa$bb')).toBe(false)
  })

  it('fingerprint is stable for a hash but changes when rehashed', async () => {
    const hash = await hashPassword('secret123')
    const fp1 = await passwordFingerprint(hash)
    const fp2 = await passwordFingerprint(hash)
    expect(fp1).toBe(fp2)

    const newHash = await hashPassword('secret123')
    expect(await passwordFingerprint(newHash)).not.toBe(fp1)
  })
})
