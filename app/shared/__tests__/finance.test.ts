import { describe, expect, it } from 'vitest'
import {
  feeStructureCreateSchema,
  feeStructureListQuerySchema,
  invoiceCreateSchema,
  invoiceListQuerySchema,
  paymentCreateSchema,
  paymentListQuerySchema,
} from '../schemas/finance'
import {
  formatMoney,
  koboToNaira,
  multiplyKobo,
  parseNairaToKobo,
  sumKobo,
} from '../utils/money'

const UUID = '11111111-1111-1111-1111-111111111111'
const UUID2 = '22222222-2222-2222-2222-222222222222'

// ₦50,000 = 5,000,000 kobo; ₦30,000 = 3,000,000; ₦2,500 = 250,000.
function feeItem(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Tuition',
    amount: 5_000_000,
    isOptional: false,
    ...overrides,
  }
}

describe('money helpers (kobo)', () => {
  it('parses valid naira strings to integer kobo', () => {
    expect(parseNairaToKobo('0')).toBe(0)
    expect(parseNairaToKobo('50000')).toBe(5_000_000)
    expect(parseNairaToKobo('50000.50')).toBe(5_000_050)
    expect(parseNairaToKobo('0.05')).toBe(5)
    expect(parseNairaToKobo(' 12.30 ')).toBe(1230)
  })

  it('rejects malformed and negative amounts', () => {
    for (const bad of [
      'abc',
      '12.345',
      '12.',
      '.50',
      '',
      '1,000.00',
      '12.3.4',
      '-15.25',
    ]) {
      expect(() => parseNairaToKobo(bad)).toThrow(/Invalid money/)
    }
  })

  it('round-trips through koboToNaira', () => {
    expect(koboToNaira(5_000_050)).toBe('50000.50')
    expect(koboToNaira(0)).toBe('0.00')
    expect(koboToNaira(1230)).toBe('12.30')
  })

  it('sums and multiplies integer kobo exactly', () => {
    expect(sumKobo(10010, 20020, 5)).toBe(30035)
    expect(multiplyKobo(1250, 3)).toBe(3750)
  })

  it('rejects non-integer quantities', () => {
    expect(() => multiplyKobo(1250, 1.5)).toThrow(/integer/)
  })

  it('formats nullish amounts as an em dash', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('')).toBe('—')
  })

  it('formats kobo integers as currency', () => {
    // ₦50,000.00
    expect(formatMoney(5_000_000)).toMatch(/50,000\.00/)
    // ₦0.05
    expect(formatMoney(5)).toMatch(/0\.05/)
  })
})

describe('fee structure schemas', () => {
  const base = {
    sessionId: UUID,
    name: 'First Term Fees',
    classId: null,
    isActive: true,
    items: [feeItem()],
  }

  it('accepts a valid structure with items', () => {
    expect(feeStructureCreateSchema.safeParse(base).success).toBe(true)
  })

  it('requires at least one fee item', () => {
    const result = feeStructureCreateSchema.safeParse({ ...base, items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects zero or negative item amounts', () => {
    expect(
      feeStructureCreateSchema.safeParse({
        ...base,
        items: [feeItem({ amount: 0 })],
      }).success,
    ).toBe(false)
    expect(
      feeStructureCreateSchema.safeParse({
        ...base,
        items: [feeItem({ amount: -1 })],
      }).success,
    ).toBe(false)
  })

  it('rejects a non-integer item amount', () => {
    expect(
      feeStructureCreateSchema.safeParse({
        ...base,
        items: [feeItem({ amount: 1.5 })],
      }).success,
    ).toBe(false)
  })

  it('coerces string isActive query params', () => {
    const parsed = feeStructureListQuerySchema.parse({ isActive: 'true' })
    expect(parsed.isActive).toBe(true)
  })
})

describe('invoice create schema', () => {
  const header = {
    studentId: UUID,
    sessionId: UUID2,
    issueDate: '2026-01-10',
  }

  it('accepts manual line items', () => {
    const result = invoiceCreateSchema.safeParse({
      ...header,
      items: [{ description: 'Books', quantity: 2, unitAmount: 250000 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a fee structure without manual items', () => {
    expect(
      invoiceCreateSchema.safeParse({
        ...header,
        feeStructureId: UUID,
      }).success,
    ).toBe(true)
  })

  it('rejects when neither structure nor items are given', () => {
    expect(invoiceCreateSchema.safeParse(header).success).toBe(false)
  })

  it('requires an issue date', () => {
    expect(
      invoiceCreateSchema.safeParse({
        studentId: UUID,
        sessionId: UUID2,
        items: [{ description: 'Books', unitAmount: 1000 }],
      }).success,
    ).toBe(false)
  })

  it('rejects invalid dates and uuids', () => {
    expect(
      invoiceCreateSchema.safeParse({
        ...header,
        issueDate: '10/01/2026',
        items: [{ description: 'Books', unitAmount: 1000 }],
      }).success,
    ).toBe(false)
    expect(
      invoiceCreateSchema.safeParse({
        ...header,
        studentId: 'not-a-uuid',
        items: [{ description: 'Books', unitAmount: 1000 }],
      }).success,
    ).toBe(false)
  })
})

describe('payment schemas', () => {
  const base = {
    invoiceId: UUID,
    amount: 3_000_000,
    method: 'cash',
  }

  it('accepts a valid payment with verifyImmediately', () => {
    const result = paymentCreateSchema.safeParse({
      ...base,
      verifyImmediately: true,
      notes: 'Paid at counter',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.verifyImmediately).toBe(true)
    }
  })

  it('rejects an unknown payment method', () => {
    expect(
      paymentCreateSchema.safeParse({ ...base, method: 'bitcoin' }).success,
    ).toBe(false)
  })

  it.each(['cash', 'bank_transfer', 'card', 'online_gateway', 'cheque', 'other'])(
    'accepts method %s',
    (method) => {
      expect(
        paymentCreateSchema.safeParse({ ...base, method }).success,
      ).toBe(true)
    },
  )

  it('rejects a zero amount', () => {
    expect(
      paymentCreateSchema.safeParse({ ...base, amount: 0 }).success,
    ).toBe(false)
  })

  it('rejects an unknown status in the list query', () => {
    expect(
      paymentListQuerySchema.safeParse({ status: 'settled' }).success,
    ).toBe(false)
  })
})

describe('finance list query pagination defaults', () => {
  it('defaults invoice list pagination', () => {
    const parsed = invoiceListQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.perPage).toBe(20)
  })

  it('rejects an out-of-range invoice status filter', () => {
    expect(
      invoiceListQuerySchema.safeParse({ status: 'drafted' }).success,
    ).toBe(false)
  })

  it('coerces numeric query strings', () => {
    const parsed = invoiceListQuerySchema.parse({ page: '3', perPage: '50' })
    expect(parsed.page).toBe(3)
    expect(parsed.perPage).toBe(50)
  })
})
