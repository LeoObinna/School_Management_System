/**
 * Paystack reference + verification-decision utils (Phase 15).
 */
import { describe, expect, it } from 'vitest'
import {
  generatePaystackReference,
  isPaystackReference,
  PAYSTACK_REFERENCE_PREFIX,
} from '../reference'
import { decideVerification } from '../decision'

describe('generatePaystackReference', () => {
  it('embeds the invoice number with a VCS prefix', () => {
    const ref = generatePaystackReference('INV-2026-0001')
    expect(ref.startsWith(`${PAYSTACK_REFERENCE_PREFIX}INV-2026-0001-`)).toBe(true)
    expect(ref.length).toBeLessThanOrEqual(100)
  })

  it('generates unique references', () => {
    const a = generatePaystackReference('INV-2026-0001')
    const b = generatePaystackReference('INV-2026-0001')
    expect(a).not.toBe(b)
  })
})

describe('isPaystackReference', () => {
  it('recognises our references only', () => {
    expect(isPaystackReference('VCS-INV-2026-0001-4f2a9c1e7b')).toBe(true)
    expect(isPaystackReference('PAY-2026-0001')).toBe(false)
    expect(isPaystackReference('')).toBe(false)
  })
})

describe('decideVerification', () => {
  const pending = { status: 'pending', amount: 150_000 }
  const successTx = { status: 'success', amount: 150_000, currency: 'NGN' }

  it('verifies a pending payment with a matching successful transaction', () => {
    expect(decideVerification(pending, successTx)).toBe('verify')
  })

  it('is a no-op for already-verified payments (replay)', () => {
    expect(
      decideVerification({ status: 'verified', amount: 150_000 }, successTx),
    ).toBe('already-verified')
  })

  it('rejects non-pending states', () => {
    for (const status of ['refunded', 'failed']) {
      expect(decideVerification({ status, amount: 1 }, successTx)).toBe(
        'not-pending',
      )
    }
  })

  it('rejects unsuccessful or missing gateway transactions', () => {
    expect(
      decideVerification(pending, { ...successTx, status: 'failed' }),
    ).toBe('not-successful')
    expect(decideVerification(pending, null)).toBe('not-successful')
  })

  it('rejects amount and currency mismatches (tamper guard)', () => {
    expect(
      decideVerification(pending, { ...successTx, amount: 149_999 }),
    ).toBe('amount-mismatch')
    expect(
      decideVerification(pending, { ...successTx, currency: 'USD' }),
    ).toBe('currency-mismatch')
  })
})
