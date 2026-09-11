import { describe, it, expect } from 'vitest'
import {
  signToken,
  verifyToken,
  deriveCsrfToken,
  newSessionId,
} from '../tokens'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  utf8ToBytes,
} from '../encoding'

const SECRET = 'test-secret-with-enough-length-0123456789'
const TTL = 600

describe('signed tokens', () => {
  it('round-trips a session token', async () => {
    const token = await signToken(
      SECRET,
      { sub: 'user-1', sid: 'sid-1', rem: false },
      { purpose: 'session', maxAgeSeconds: TTL },
    )
    const claims = await verifyToken(SECRET, token, 'session')
    expect(claims).not.toBeNull()
    expect(claims?.sub).toBe('user-1')
    expect(claims?.sid).toBe('sid-1')
    expect(claims?.pur).toBe('session')
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken(
      SECRET,
      { sub: 'user-1', sid: 'sid-1' },
      { purpose: 'session', maxAgeSeconds: TTL },
    )
    const [payload, signature] = token.split('.')
    const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload!)))
    json.sub = 'user-2'
    const forgedPayload = bytesToBase64Url(utf8ToBytes(JSON.stringify(json)))
    const forged = `${forgedPayload}.${signature}`
    expect(await verifyToken(SECRET, forged, 'session')).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(
      SECRET,
      { sub: 'user-1', sid: 'sid-1' },
      { purpose: 'session', maxAgeSeconds: TTL },
    )
    expect(await verifyToken('another-secret', token, 'session')).toBeNull()
  })

  it('rejects a token used for the wrong purpose', async () => {
    const token = await signToken(
      SECRET,
      { sub: 'user-1', sid: 'sid-1' },
      { purpose: 'session', maxAgeSeconds: TTL },
    )
    expect(await verifyToken(SECRET, token, 'reset')).toBeNull()
  })

  it('rejects an expired token', async () => {
    const now = 1_000_000
    const token = await signToken(
      SECRET,
      { sub: 'user-1', sid: 'sid-1' },
      { purpose: 'session', maxAgeSeconds: 60, now },
    )
    expect(
      await verifyToken(SECRET, token, 'session', now + 61),
    ).toBeNull()
    expect(
      await verifyToken(SECRET, token, 'session', now + 30),
    ).not.toBeNull()
  })

  it('rejects malformed tokens and empty secrets', async () => {
    expect(await verifyToken(SECRET, 'garbage', 'session')).toBeNull()
    expect(await verifyToken(SECRET, 'a.b.c', 'session')).toBeNull()
    expect(await verifyToken('', 'a.b', 'session')).toBeNull()
  })

  it('fails when signing without a secret', async () => {
    await expect(
      signToken('', { x: 1 }, { purpose: 'session', maxAgeSeconds: 60 }),
    ).rejects.toThrow()
  })
})

describe('CSRF token', () => {
  it('is deterministic for a session id but distinct across sessions', async () => {
    const a1 = await deriveCsrfToken(SECRET, 'sid-a')
    const a2 = await deriveCsrfToken(SECRET, 'sid-a')
    const b = await deriveCsrfToken(SECRET, 'sid-b')
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
  })
})

describe('newSessionId', () => {
  it('generates unique tokens', () => {
    expect(newSessionId()).not.toBe(newSessionId())
    expect(newSessionId().length).toBeGreaterThan(20)
  })
})
