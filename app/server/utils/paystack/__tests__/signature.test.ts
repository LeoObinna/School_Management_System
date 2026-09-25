/**
 * Paystack signature utils (Phase 15). Expected HMACs are computed with
 * node:crypto — an independent implementation from the Web Crypto path
 * under test.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  computePaystackSignature,
  verifyPaystackSignature,
} from '../signature'

const SECRET = 'sk_test_example_secret'
const BODY = JSON.stringify({
  event: 'charge.success',
  data: { reference: 'VCS-INV-2026-0001-4f2a9c1e7b' },
})

function nodeHmac(secret: string, body: string): string {
  return createHmac('sha512', secret).update(body, 'utf8').digest('hex')
}

describe('computePaystackSignature', () => {
  it('matches node:crypto HMAC-SHA512 hex', async () => {
    const ours = await computePaystackSignature(SECRET, BODY)
    expect(ours).toBe(nodeHmac(SECRET, BODY))
    expect(ours).toMatch(/^[0-9a-f]{128}$/)
  })

  it('is deterministic and body-sensitive', async () => {
    const a = await computePaystackSignature(SECRET, BODY)
    const b = await computePaystackSignature(SECRET, BODY)
    const c = await computePaystackSignature(SECRET, BODY + ' ')
    expect(a).toBe(b)
    expect(c).not.toBe(a)
  })
})

describe('verifyPaystackSignature', () => {
  it('accepts the correct signature', async () => {
    await expect(
      verifyPaystackSignature(SECRET, BODY, nodeHmac(SECRET, BODY)),
    ).resolves.toBe(true)
  })

  it('rejects a signature computed with a different secret', async () => {
    await expect(
      verifyPaystackSignature(SECRET, BODY, nodeHmac('wrong', BODY)),
    ).resolves.toBe(false)
  })

  it('rejects a signature over a tampered body', async () => {
    const sig = nodeHmac(SECRET, BODY)
    const tampered = BODY.replace('success', 'failed')
    await expect(
      verifyPaystackSignature(SECRET, tampered, sig),
    ).resolves.toBe(false)
  })

  it('fails closed on missing secret or signature', async () => {
    await expect(verifyPaystackSignature('', BODY, 'abc')).resolves.toBe(false)
    await expect(verifyPaystackSignature(SECRET, BODY, null)).resolves.toBe(false)
    await expect(verifyPaystackSignature(SECRET, BODY, '')).resolves.toBe(false)
  })

  it('rejects malformed hex without throwing', async () => {
    await expect(
      verifyPaystackSignature(SECRET, BODY, 'not-hex'),
    ).resolves.toBe(false)
  })
})
