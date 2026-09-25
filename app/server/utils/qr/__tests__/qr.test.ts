import { describe, it, expect } from 'vitest'
import {
  buildInvoiceQrPayload,
  buildOfficeQrPayload,
  buildReceiptQrPayload,
} from '../payload'
import { qrMatrix, renderQrSvg } from '../render'
import type { SchoolSettings } from '../../../../shared/types'

const settings: SchoolSettings = {
  name: 'Victorious Children School',
  motto: null,
  address: null,
  email: null,
  phone: null,
  logoKey: null,
  primaryColor: null,
  secondaryColor: null,
  currency: 'NGN',
  bankName: 'Demo Bank PLC',
  accountName: 'Victorious Children School',
  accountNumber: '0123456789',
  academicYearStartMonth: 9,
}

const noBank: SchoolSettings = {
  ...settings,
  bankName: null,
  accountName: null,
  accountNumber: null,
}

describe('buildOfficeQrPayload', () => {
  it('encodes the school bank details', () => {
    const payload = buildOfficeQrPayload(settings)
    expect(payload).toContain('Victorious Children School')
    expect(payload).toContain('Bank: Demo Bank PLC')
    expect(payload).toContain('Account name: Victorious Children School')
    expect(payload).toContain('Account number: 0123456789')
  })

  it('falls back to the school name for the account name', () => {
    const payload = buildOfficeQrPayload({ ...settings, accountName: null })
    expect(payload).toContain('Account name: Victorious Children School')
  })

  it('returns null when bank details are not configured', () => {
    expect(buildOfficeQrPayload(noBank)).toBeNull()
    expect(
      buildOfficeQrPayload({ ...settings, accountNumber: null }),
    ).toBeNull()
  })
})

describe('buildInvoiceQrPayload', () => {
  it('adds the invoice reference and amount due', () => {
    const payload = buildInvoiceQrPayload(settings, {
      invoiceNumber: 'INV-2026-0001',
      balance: 15_000_000,
    })
    expect(payload).toContain('Bank: Demo Bank PLC')
    expect(payload).toContain('Reference: INV-2026-0001')
    expect(payload).toContain('Amount due: NGN 150,000.00')
  })

  it('returns null when bank details are not configured', () => {
    expect(
      buildInvoiceQrPayload(noBank, {
        invoiceNumber: 'INV-2026-0001',
        balance: 100,
      }),
    ).toBeNull()
  })
})

describe('buildReceiptQrPayload', () => {
  it('encodes the receipt and payment references with the amount', () => {
    const payload = buildReceiptQrPayload({
      receiptNumber: 'RCT-2026-0001',
      paymentReference: 'PAY-2026-0001',
      amount: 3_000_000,
    })
    expect(payload).toContain('Receipt RCT-2026-0001')
    expect(payload).toContain('Payment PAY-2026-0001')
    expect(payload).toContain('Amount NGN 30,000.00')
  })
})

describe('qrMatrix', () => {
  it('returns a square module matrix with dark and light modules', () => {
    const m = qrMatrix('hello world')
    expect(m.size).toBeGreaterThan(20)
    let dark = 0
    let light = 0
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        if (m.isDark(r, c)) dark += 1
        else light += 1
      }
    }
    expect(dark).toBeGreaterThan(0)
    expect(light).toBeGreaterThan(0)
  })

  it('is deterministic for the same input', () => {
    const a = qrMatrix('VCS receipt check')
    const b = qrMatrix('VCS receipt check')
    expect(a.size).toBe(b.size)
    for (let r = 0; r < a.size; r++) {
      for (let c = 0; c < a.size; c++) {
        expect(a.isDark(r, c)).toBe(b.isDark(r, c))
      }
    }
  })
})

describe('renderQrSvg', () => {
  it('produces an SVG string with a path', async () => {
    const svg = await renderQrSvg('hello world')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path')
    expect(svg).toContain('</svg>')
  })

  it('honours the requested width', async () => {
    const svg = await renderQrSvg('hello world', 256)
    expect(svg).toContain('width="256"')
  })
})
