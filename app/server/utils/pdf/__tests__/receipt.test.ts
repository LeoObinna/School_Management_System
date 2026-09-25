import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import {
  buildReceiptObjectKey,
  formatReceiptMoney,
  parseHexColor,
  renderReceiptPdf,
  type ReceiptData,
} from '../receipt'
import type { SchoolSettings } from '../../../../shared/types'

// Same technique as report-card.test.ts: pdf-lib FlateDecode-compresses
// content streams, so inflate every `stream … endstream` block and
// hex-decode the `<…>` text operands before asserting on content.
function extractText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes)
  const chunks: Buffer[] = []
  const tag = 'stream'
  let idx = 0
  while (idx < buf.length) {
    const start = buf.indexOf(tag, idx)
    if (start < 0) break
    if (start >= 3 && buf.subarray(start - 3, start).toString() === 'end') {
      idx = start + tag.length
      continue
    }
    let dataStart = start + tag.length
    if (buf[dataStart] === 0x0d) dataStart += 1
    if (buf[dataStart] === 0x0a) dataStart += 1
    const end = buf.indexOf('endstream', dataStart)
    if (end < 0) break
    const segment = buf.subarray(dataStart, end)
    try {
      chunks.push(inflateSync(segment))
    } catch {
      chunks.push(segment)
    }
    idx = end + 'endstream'.length
  }
  let text = Buffer.concat(chunks).toString('latin1')
  text = text.replace(/<([0-9A-Fa-f\s]+)>/g, (match, hex: string) => {
    const cleaned = hex.replace(/\s/g, '')
    if (cleaned.length % 2 !== 0) return match
    let decoded = ''
    for (let i = 0; i < cleaned.length; i += 2) {
      decoded += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16))
    }
    return decoded
  })
  return text
}

const baseSettings: SchoolSettings = {
  name: 'Victorious Children School',
  motto: 'Knowledge and Integrity',
  address: '12 Ojodu Road, Lagos',
  email: 'info@victoriouschildren.school',
  phone: '0800 000 0000',
  logoKey: null,
  primaryColor: '#1a237e',
  secondaryColor: null,
  currency: 'NGN',
  bankName: 'Demo Bank PLC',
  accountName: 'Victorious Children School',
  accountNumber: '0123456789',
  academicYearStartMonth: 9,
}

const baseReceipt: ReceiptData = {
  receiptNumber: 'RCT-2026-0001',
  issuedAt: '2026-09-20T10:30:00.000Z',
  paymentReference: 'PAY-2026-0001',
  providerReference: 'VCS-INV-2026-0001-abcdef1234',
  method: 'online_gateway',
  amount: 15_000_000,
  paidAt: '2026-09-20T10:30:00.000Z',
  studentName: 'Jane Doe',
  admissionNumber: 'ADM-001',
  className: 'Grade 5',
  invoiceNumber: 'INV-2026-0001',
  sessionName: '2026-2027',
  termName: 'Term 1',
  items: [
    {
      description: 'Tuition fee',
      quantity: 1,
      unitAmount: 12_000_000,
      lineTotal: 12_000_000,
    },
    {
      description: 'PTA levy',
      quantity: 1,
      unitAmount: 3_000_000,
      lineTotal: 3_000_000,
    },
  ],
  invoiceTotal: 15_000_000,
  invoiceAmountPaid: 15_000_000,
  invoiceBalance: 0,
}

describe('buildReceiptObjectKey', () => {
  it('builds a deterministic key under receipts/', () => {
    const key = buildReceiptObjectKey('RCT-2026-0001')
    expect(key).toBe('receipts/RCT-2026-0001.pdf')
    expect(buildReceiptObjectKey('RCT-2026-0001')).toBe(key)
  })

  it('strips non-safe characters from the receipt number', () => {
    expect(buildReceiptObjectKey('RCT/2026?0001')).toBe(
      'receipts/RCT20260001.pdf',
    )
  })
})

describe('parseHexColor', () => {
  it('parses a 6-digit hex color', () => {
    const c = parseHexColor('#1a237e') as unknown as Record<string, number>
    expect(c.red).toBeCloseTo(0x1a / 255, 5)
    expect(c.green).toBeCloseTo(0x23 / 255, 5)
    expect(c.blue).toBeCloseTo(0x7e / 255, 5)
  })

  it('accepts hex without the leading #', () => {
    const c = parseHexColor('ff0000') as unknown as Record<string, number>
    expect(c.red).toBe(1)
    expect(c.green).toBe(0)
    expect(c.blue).toBe(0)
  })

  it('falls back to navy for invalid input', () => {
    const c = parseHexColor('not-a-color') as unknown as Record<string, number>
    expect(c.red).toBeCloseTo(0.102, 3)
    expect(c.green).toBeCloseTo(0.137, 3)
    expect(c.blue).toBeCloseTo(0.494, 3)
  })
})

describe('formatReceiptMoney', () => {
  it('formats kobo as ASCII-safe NGN with comma grouping', () => {
    expect(formatReceiptMoney(15_000_000)).toBe('NGN 150,000.00')
    expect(formatReceiptMoney(5_000)).toBe('NGN 50.00')
    expect(formatReceiptMoney(0)).toBe('NGN 0.00')
    expect(formatReceiptMoney(99)).toBe('NGN 0.99')
  })

  it('formats negative amounts with a leading minus', () => {
    expect(formatReceiptMoney(-12_345)).toBe('-NGN 123.45')
  })
})

describe('renderReceiptPdf', () => {
  it('returns Uint8Array starting with the PDF magic header', async () => {
    const bytes = await renderReceiptPdf(baseReceipt, baseSettings)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('produces a single page for a typical receipt', async () => {
    const doc = await PDFDocument.load(
      await renderReceiptPdf(baseReceipt, baseSettings),
    )
    expect(doc.getPageCount()).toBe(1)
  })

  it('renders the school branding header', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('VICTORIOUS CHILDREN SCHOOL')
    expect(text).toContain('Knowledge and Integrity')
    expect(text).toContain('12 Ojodu Road, Lagos')
    expect(text).toContain('OFFICIAL PAYMENT RECEIPT')
  })

  it('renders receipt meta and the student/invoice block', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('Receipt no: RCT-2026-0001')
    expect(text).toContain('Payment reference: PAY-2026-0001')
    expect(text).toContain('Gateway reference: VCS-INV-2026-0001-abcdef1234')
    expect(text).toContain('Received from: Jane Doe')
    expect(text).toContain('Admission no: ADM-001')
    expect(text).toContain('Class: Grade 5')
    expect(text).toContain('Invoice: INV-2026-0001')
    expect(text).toContain('2026-2027')
    expect(text).toContain('Term 1')
  })

  it('renders the items table and totals in NGN', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('Tuition fee')
    expect(text).toContain('PTA levy')
    expect(text).toContain('NGN 120,000.00')
    expect(text).toContain('NGN 30,000.00')
    expect(text).toContain('Invoice total')
    expect(text).toContain('This payment')
    expect(text).toContain('Paid to date')
    expect(text).toContain('Balance')
    expect(text).toContain('NGN 150,000.00')
    expect(text).toContain('NGN 0.00')
  })

  it('renders the payment method with underscores replaced', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('Payment method: online gateway')
  })

  it('includes the bank block when bank details are configured', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('School bank details')
    expect(text).toContain('Demo Bank PLC')
    expect(text).toContain('0123456789')
  })

  it('omits the bank block when bank details are missing', async () => {
    const noBank: SchoolSettings = {
      ...baseSettings,
      bankName: null,
      accountNumber: null,
    }
    const text = extractText(await renderReceiptPdf(baseReceipt, noBank))
    expect(text).not.toContain('School bank details')
    const partial: SchoolSettings = { ...baseSettings, accountNumber: null }
    const text2 = extractText(await renderReceiptPdf(baseReceipt, partial))
    expect(text2).not.toContain('School bank details')
  })

  it('omits the gateway reference line when null', async () => {
    const receipt: ReceiptData = { ...baseReceipt, providerReference: null }
    const text = extractText(await renderReceiptPdf(receipt, baseSettings))
    expect(text).not.toContain('Gateway reference')
  })

  it('renders the electronic-issue footer', async () => {
    const text = extractText(await renderReceiptPdf(baseReceipt, baseSettings))
    expect(text).toContain('valid without a signature')
  })

  it('paginates when many items overflow one page', async () => {
    const receipt: ReceiptData = {
      ...baseReceipt,
      items: Array.from({ length: 40 }, (_, i) => ({
        description: `Fee purpose number ${i + 1}`,
        quantity: 1,
        unitAmount: 100_000,
        lineTotal: 100_000,
      })),
    }
    const bytes = await renderReceiptPdf(receipt, baseSettings)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
    const text = extractText(bytes)
    expect(text).toContain('Fee purpose number 1')
    expect(text).toContain('Fee purpose number 40')
  })

  it('truncates very long item descriptions', async () => {
    const receipt: ReceiptData = {
      ...baseReceipt,
      items: [
        {
          description: `Extremely long fee purpose description ${'x'.repeat(200)}`,
          quantity: 1,
          unitAmount: 100,
          lineTotal: 100,
        },
      ],
    }
    const text = extractText(await renderReceiptPdf(receipt, baseSettings))
    expect(text).toContain('...')
    expect(text).not.toContain('x'.repeat(200))
  })
})
