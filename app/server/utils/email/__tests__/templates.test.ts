/**
 * Phase 17A: email template tests.
 */
import { describe, expect, it } from 'vitest'
import {
  announcementEmail,
  feeReminderEmail,
  resultPublishedEmail,
  paymentReceiptEmail,
  type SchoolBranding,
} from '../templates'

const branding: SchoolBranding = {
  schoolName: 'Victorious Children School',
  motto: 'Not to Equal, But to Excel',
  primaryColor: '#1a237e',
  logoUrl: 'https://example.com/logo.png',
}

describe('announcementEmail', () => {
  it('produces subject, html and text', () => {
    const t = announcementEmail(
      branding,
      { title: 'School Reopens', body: 'We resume on Monday.' },
      'https://portal.example.com/announcements',
    )
    expect(t.subject).toBe(
      '[Victorious Children School] School Reopens',
    )
    expect(t.html).toContain('School Reopens')
    expect(t.html).toContain('We resume on Monday.')
    expect(t.html).toContain('Victorious Children School')
    expect(t.text).toContain('School Reopens')
    expect(t.text).toContain('We resume on Monday.')
  })

  it('handles null body', () => {
    const t = announcementEmail(
      branding,
      { title: 'Notice', body: null },
      'https://portal.example.com/announcements',
    )
    expect(t.html).toContain('Notice')
    expect(t.text).toContain('Notice')
  })

  it('converts newlines in body to <br> in HTML', () => {
    const t = announcementEmail(
      branding,
      { title: 'Multi-line', body: 'Line 1\nLine 2' },
      'https://portal.example.com/announcements',
    )
    expect(t.html).toContain('Line 1<br>Line 2')
  })
})

describe('feeReminderEmail', () => {
  it('lists overdue invoices with balances', () => {
    const t = feeReminderEmail(
      branding,
      'Mrs. Adebayo',
      [
        {
          studentName: 'Tobi Adebayo',
          invoiceNumber: 'INV-2026-001',
          balance: '₦150,000.00',
          dueDate: '2026-09-15',
        },
        {
          studentName: 'Tobi Adebayo',
          invoiceNumber: 'INV-2026-002',
          balance: '₦25,000.00',
          dueDate: null,
        },
      ],
      'https://portal.example.com/billing',
    )
    expect(t.subject).toContain('Fee Reminder')
    expect(t.html).toContain('Mrs. Adebayo')
    expect(t.html).toContain('Tobi Adebayo')
    expect(t.html).toContain('₦150,000.00')
    expect(t.html).toContain('₦25,000.00')
    expect(t.text).toContain('INV-2026-001')
    expect(t.text).toContain('INV-2026-002')
  })
})

describe('resultPublishedEmail', () => {
  it('includes student, class and term names', () => {
    const t = resultPublishedEmail(
      branding,
      'Mrs. Adebayo',
      'Tobi Adebayo',
      'Primary 3',
      'First Term',
      'https://portal.example.com/portal/parent',
    )
    expect(t.subject).toContain('Tobi Adebayo')
    expect(t.html).toContain('Tobi Adebayo')
    expect(t.html).toContain('Primary 3')
    expect(t.html).toContain('First Term')
    expect(t.text).toContain('Tobi Adebayo')
  })
})

describe('paymentReceiptEmail', () => {
  it('includes receipt number, amount and student', () => {
    const t = paymentReceiptEmail(
      branding,
      'Mrs. Adebayo',
      'RCP-2026-001',
      '₦150,000.00',
      'Tobi Adebayo',
      'INV-2026-001',
      'https://portal.example.com/billing',
    )
    expect(t.subject).toContain('RCP-2026-001')
    expect(t.html).toContain('RCP-2026-001')
    expect(t.html).toContain('₦150,000.00')
    expect(t.html).toContain('Tobi Adebayo')
    expect(t.text).toContain('RCP-2026-001')
  })
})

describe('shell (shared)', () => {
  it('includes the school name in the header', () => {
    const t = announcementEmail(
      branding,
      { title: 'Test', body: null },
      'https://example.com',
    )
    expect(t.html).toContain('Victorious Children School')
  })

  it('includes the motto when present', () => {
    const t = announcementEmail(
      branding,
      { title: 'Test', body: null },
      'https://example.com',
    )
    expect(t.html).toContain('Not to Equal, But to Excel')
  })

  it('omits the motto line when null', () => {
    const noMotto = { ...branding, motto: null }
    const t = announcementEmail(
      noMotto,
      { title: 'Test', body: null },
      'https://example.com',
    )
    expect(t.html).not.toContain('Not to Equal')
  })

  it('omits the logo when null', () => {
    const noLogo = { ...branding, logoUrl: null }
    const t = announcementEmail(
      noLogo,
      { title: 'Test', body: null },
      'https://example.com',
    )
    expect(t.html).not.toContain('<img')
  })

  it('uses the primary color in the header', () => {
    const t = announcementEmail(
      branding,
      { title: 'Test', body: null },
      'https://example.com',
    )
    expect(t.html).toContain('#1a237e')
  })
})
