import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import {
  renderAuditCertificatePdf,
  type AuditCertificateModel,
} from '../audit-certificate'
import type { AuditCertificateSummary } from '../../../../shared/types'

// Same extraction technique as report-card.test.ts: inflate every
// flate stream and decode pdf-lib's `<hex> Tj` text operands.
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
  return Buffer.concat(chunks)
    .toString('latin1')
    .replace(/<([0-9A-Fa-f\s]+)>/g, (match, hex: string) => {
      const cleaned = hex.replace(/\s/g, '')
      if (cleaned.length % 2 !== 0) return match
      let decoded = ''
      for (let i = 0; i < cleaned.length; i += 2) {
        decoded += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16))
      }
      return decoded
    })
}

function summary(
  overrides: Partial<AuditCertificateSummary> = {},
): AuditCertificateSummary {
  return {
    total: 42,
    byAction: [
      { action: 'auth.login.success', count: 20 },
      { action: 'student.create', count: 12 },
      { action: 'report_card.publish', count: 10 },
    ],
    earliestAt: '2026-01-15T08:30:00.000Z',
    latestAt: '2026-09-17T14:05:00.000Z',
    filters: {
      dateFrom: null,
      dateTo: null,
      action: null,
      resource: null,
      userId: null,
    },
    ...overrides,
  }
}

function model(
  overrides: Partial<AuditCertificateModel> = {},
): AuditCertificateModel {
  return {
    generatedAt: '2026-09-17T15:00:00.000Z',
    generatedBy: { name: 'Ada Admin', email: 'ada@school.example' },
    summary: summary(),
    ...overrides,
  }
}

describe('renderAuditCertificatePdf', () => {
  it('returns a valid PDF', async () => {
    const bytes = await renderAuditCertificatePdf(model())
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('renders title, actor and generation timestamp', async () => {
    const text = extractText(await renderAuditCertificatePdf(model()))
    expect(text).toContain('Audit Certificate')
    expect(text).toContain('Activity Attestation')
    expect(text).toContain('Ada Admin')
    expect(text).toContain('ada@school.example')
  })

  it('renders "all time / all" scope when no filters are set', async () => {
    const text = extractText(await renderAuditCertificatePdf(model()))
    expect(text).toContain('All time')
    expect(text).toContain('All actions')
    expect(text).toContain('All resources')
    expect(text).toContain('All users')
  })

  it('renders the explicit filter period and criteria', async () => {
    const m = model({
      summary: summary({
        filters: {
          dateFrom: '2026-01-15',
          dateTo: '2026-09-17',
          action: 'auth.login.success',
          resource: 'student',
          userId: '99999999-9999-4999-8999-999999999999',
        },
      }),
    })
    const text = extractText(await renderAuditCertificatePdf(m))
    expect(text).toContain('15/01/2026')
    expect(text).toContain('17/09/2026')
    expect(text).toContain('auth.login.success')
    expect(text).toContain('student')
    expect(text).toContain('99999999-9999-4999-8999-999999999999')
  })

  it('renders totals and the per-action breakdown table', async () => {
    const text = extractText(await renderAuditCertificatePdf(model()))
    expect(text).toContain('Total records')
    expect(text).toContain('42')
    expect(text).toContain('Records by action')
    expect(text).toContain('auth.login.success')
    expect(text).toContain('student.create')
    expect(text).toContain('report_card.publish')
    expect(text).toContain('20')
    expect(text).toContain('12')
    expect(text).toContain('10')
  })

  it('includes the append-only statement and a reference', async () => {
    const text = extractText(await renderAuditCertificatePdf(model()))
    expect(text).toContain('append-only')
    expect(text).toContain('not')
    expect(text).toContain('cryptographically signed')
    expect(text).toContain('audit-certificate-')
  })

  it('shows the empty-state note when there are no records', async () => {
    const m = model({
      summary: summary({ total: 0, byAction: [] }),
    })
    const text = extractText(await renderAuditCertificatePdf(m))
    expect(text).toContain('No audit records match')
    expect(text).toContain('0')
  })

  it('paginates a very long action breakdown', async () => {
    const byAction = Array.from({ length: 60 }, (_, i) => ({
      action: `action.number.${String(i + 1).padStart(2, '0')}`,
      count: i + 1,
    }))
    const m = model({ summary: summary({ total: 1830, byAction }) })
    const bytes = await renderAuditCertificatePdf(m)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
    const text = extractText(bytes)
    expect(text).toContain('action.number.01')
    expect(text).toContain('action.number.60')
  })
})
