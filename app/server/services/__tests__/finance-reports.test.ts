/**
 * Pure-reducer tests for the Phase 14D expanded financial reports.
 * DB access and authorization are exercised via the API; these cover
 * the kobo-exact allocation and grouping math.
 */
import { describe, expect, it } from 'vitest'
import {
  aggregateByClass,
  aggregateByTerm,
  aggregateFeePurposes,
  allocateAcrossLines,
  UNASSIGNED_CLASS,
  UNASSIGNED_TERM,
  type ClassMeta,
  type ScopedEnrollment,
  type ScopedInvoice,
  type ScopedLine,
  type TermMeta,
} from '../finance-reports'

const noFilters = { sessionId: null, termId: null, classId: null }

function inv(partial: Partial<ScopedInvoice> & { id: string }): ScopedInvoice {
  return {
    studentId: 'stu-1',
    sessionId: 'ses-1',
    termId: null,
    total: 0,
    amountPaid: 0,
    balance: 0,
    ...partial,
  }
}

describe('allocateAcrossLines (largest remainder)', () => {
  it('splits exactly when divisible', () => {
    expect(allocateAcrossLines([5000, 5000], 2000)).toEqual([1000, 1000])
  })

  it('allocates every kobo with no rounding loss', () => {
    const a = allocateAcrossLines([1, 1, 1], 1)
    expect(a).toEqual([1, 0, 0])
    expect(a.reduce((s, v) => s + v, 0)).toBe(1)

    const b = allocateAcrossLines([1, 1, 1], 2)
    expect(b).toEqual([1, 1, 0])
    expect(b.reduce((s, v) => s + v, 0)).toBe(2)
  })

  it('gives the remainder kobo to the largest fractional share', () => {
    // weights 333/333/334, amount 100: shares 33.3, 33.3, 33.4
    expect(allocateAcrossLines([333, 333, 334], 100)).toEqual([33, 33, 34])
  })

  it('weights uneven lines proportionally', () => {
    // 10000:5000 = 2:1, paid 3000
    expect(allocateAcrossLines([10000, 5000], 3000)).toEqual([2000, 1000])
  })

  it('handles full and zero payments', () => {
    expect(allocateAcrossLines([400, 600], 1000)).toEqual([400, 600])
    expect(allocateAcrossLines([400, 600], 0)).toEqual([0, 0])
  })

  it('returns zeros when all line weights are zero', () => {
    expect(allocateAcrossLines([0, 0], 500)).toEqual([0, 0])
  })

  it('never over-allocates even when amount exceeds weights', () => {
    // Defensive: overpaid invoices should not reach here, but if they
    // do, allocations must stay exact integers.
    const result = allocateAcrossLines([50, 50], 150)
    expect(result.every(Number.isInteger)).toBe(true)
    expect(result).toEqual([75, 75])
  })
})

describe('aggregateFeePurposes', () => {
  it('allocates a partial payment proportionally and balances each row', () => {
    const invoices = [
      inv({
        id: 'inv-1',
        total: 15000,
        amountPaid: 3000,
        balance: 12000,
      }),
    ]
    const lines: ScopedLine[] = [
      { invoiceId: 'inv-1', purpose: 'Tuition', lineTotal: 10000 },
      { invoiceId: 'inv-1', purpose: 'Uniform', lineTotal: 5000 },
    ]
    const report = aggregateFeePurposes(invoices, lines, noFilters)
    const byName = Object.fromEntries(
      report.data.map((r) => [r.purpose, r]),
    )
    expect(byName.Tuition!.collected).toBe(2000)
    expect(byName.Tuition!.outstanding).toBe(8000)
    expect(byName.Uniform!.collected).toBe(1000)
    expect(byName.Uniform!.outstanding).toBe(4000)
    // Each purpose row balances: billed = collected + outstanding.
    for (const row of report.data) {
      expect(row.billed).toBe(row.collected + row.outstanding)
    }
    expect(report.totals.collected).toBe(3000)
    expect(report.totals.billed).toBe(15000)
    expect(report.totals.invoiceCount).toBe(1)
  })

  it('merges the same purpose across invoices with distinct counts', () => {
    const invoices = [
      inv({ id: 'inv-1', total: 100, amountPaid: 100, balance: 0 }),
      inv({ id: 'inv-2', total: 200, amountPaid: 0, balance: 200 }),
    ]
    const lines: ScopedLine[] = [
      { invoiceId: 'inv-1', purpose: 'Tuition', lineTotal: 100 },
      { invoiceId: 'inv-2', purpose: 'Tuition', lineTotal: 200 },
    ]
    const report = aggregateFeePurposes(invoices, lines, noFilters)
    expect(report.data).toHaveLength(1)
    expect(report.data[0]).toMatchObject({
      purpose: 'Tuition',
      lineCount: 2,
      invoiceCount: 2,
      billed: 300,
      collected: 100,
      outstanding: 200,
    })
  })

  it('distributes indivisible kobo with no lost money', () => {
    const invoices = [
      inv({ id: 'inv-1', total: 3, amountPaid: 1, balance: 2 }),
    ]
    const lines: ScopedLine[] = [
      { invoiceId: 'inv-1', purpose: 'A', lineTotal: 1 },
      { invoiceId: 'inv-1', purpose: 'B', lineTotal: 2 },
    ]
    const report = aggregateFeePurposes(invoices, lines, noFilters)
    expect(report.totals.collected).toBe(1)
    const collected = report.data.reduce((s, r) => s + r.collected, 0)
    expect(collected).toBe(1)
  })

  it('sorts purposes by billed amount descending', () => {
    const invoices = [
      inv({ id: 'inv-1', total: 300, amountPaid: 0, balance: 300 }),
    ]
    const lines: ScopedLine[] = [
      { invoiceId: 'inv-1', purpose: 'Small', lineTotal: 100 },
      { invoiceId: 'inv-1', purpose: 'Large', lineTotal: 200 },
    ]
    const report = aggregateFeePurposes(invoices, lines, noFilters)
    expect(report.data.map((r) => r.purpose)).toEqual(['Large', 'Small'])
  })

  it('ignores invoices that have no lines', () => {
    const invoices = [
      inv({ id: 'inv-1', total: 500, amountPaid: 0, balance: 500 }),
    ]
    const report = aggregateFeePurposes(invoices, [], noFilters)
    expect(report.data).toHaveLength(0)
    // Invoice is still counted in the scope totals.
    expect(report.totals.invoiceCount).toBe(1)
  })
})

describe('aggregateByClass', () => {
  const classList: ClassMeta[] = [
    { id: 'cls-a', name: 'JSS 1', sequence: 1 },
    { id: 'cls-b', name: 'JSS 2', sequence: 2 },
  ]
  const enrollments: ScopedEnrollment[] = [
    { studentId: 's1', sessionId: 'ses-1', classId: 'cls-a' },
    { studentId: 's2', sessionId: 'ses-1', classId: 'cls-b' },
  ]

  it('groups invoice totals by active-enrollment class', () => {
    const invoices = [
      inv({ id: 'i1', studentId: 's1', total: 1000, amountPaid: 400, balance: 600 }),
      inv({ id: 'i2', studentId: 's1', total: 500, amountPaid: 500, balance: 0 }),
      inv({ id: 'i3', studentId: 's2', total: 2000, amountPaid: 0, balance: 2000 }),
    ]
    const report = aggregateByClass(invoices, enrollments, classList, noFilters)
    const a = report.data.find((r) => r.classId === 'cls-a')!
    expect(a.invoiceCount).toBe(2)
    expect(a.studentCount).toBe(1)
    expect(a.billed).toBe(1500)
    expect(a.collected).toBe(900)
    expect(a.outstanding).toBe(600)
    expect(report.totals.billed).toBe(3500)
  })

  it('groups students without an active enrollment as Unassigned, last', () => {
    const invoices = [
      inv({ id: 'i1', studentId: 's1', total: 100, amountPaid: 0, balance: 100 }),
      inv({ id: 'i2', studentId: 's9', total: 200, amountPaid: 0, balance: 200 }),
    ]
    const report = aggregateByClass(invoices, enrollments, classList, noFilters)
    expect(report.data.map((r) => r.className)).toEqual([
      'JSS 1',
      UNASSIGNED_CLASS,
    ])
    const unassigned = report.data.at(-1)!
    expect(unassigned.classId).toBeNull()
    expect(unassigned.billed).toBe(200)
  })

  it('picks one class deterministically on duplicate active enrollments', () => {
    const dupes: ScopedEnrollment[] = [
      { studentId: 's1', sessionId: 'ses-1', classId: 'cls-b' },
      { studentId: 's1', sessionId: 'ses-1', classId: 'cls-a' },
    ]
    const invoices = [
      inv({ id: 'i1', studentId: 's1', total: 100, amountPaid: 0, balance: 100 }),
    ]
    const report = aggregateByClass(invoices, dupes, classList, noFilters)
    expect(report.data).toHaveLength(1)
    // Lowest id wins.
    expect(report.data[0]!.classId).toBe('cls-a')
  })

  it('does not leak an enrollment from another session', () => {
    const invoices = [
      inv({ id: 'i1', studentId: 's1', sessionId: 'ses-2', total: 100, amountPaid: 0, balance: 100 }),
    ]
    const report = aggregateByClass(invoices, enrollments, classList, noFilters)
    expect(report.data[0]!.className).toBe(UNASSIGNED_CLASS)
  })
})

describe('aggregateByTerm', () => {
  const termList: TermMeta[] = [
    { id: 't2', sessionId: 'ses-1', name: 'Second', sequence: 2, startDate: '2026-01-05' },
    { id: 't1', sessionId: 'ses-1', name: 'First', sequence: 1, startDate: '2025-09-08' },
  ]

  it('groups by term and orders chronologically', () => {
    const invoices = [
      inv({ id: 'i1', termId: 't2', total: 200, amountPaid: 0, balance: 200 }),
      inv({ id: 'i2', termId: 't1', total: 100, amountPaid: 100, balance: 0 }),
    ]
    const report = aggregateByTerm(invoices, termList, noFilters)
    expect(report.data.map((r) => r.termName)).toEqual(['First', 'Second'])
    const first = report.data[0]!
    expect(first.billed).toBe(100)
    expect(first.collected).toBe(100)
    expect(first.studentCount).toBe(1)
    expect(report.totals.billed).toBe(300)
    expect(report.totals.collected).toBe(100)
    expect(report.totals.outstanding).toBe(200)
  })

  it('groups invoices without a term as Unassigned term, last', () => {
    const invoices = [
      inv({ id: 'i1', termId: 't1', total: 100, amountPaid: 0, balance: 100 }),
      inv({ id: 'i2', termId: null, total: 50, amountPaid: 0, balance: 50 }),
    ]
    const report = aggregateByTerm(invoices, termList, noFilters)
    expect(report.data.map((r) => r.termName)).toEqual([
      'First',
      UNASSIGNED_TERM,
    ])
    expect(report.data.at(-1)!.billed).toBe(50)
  })

  it('counts distinct students per term', () => {
    const invoices = [
      inv({ id: 'i1', studentId: 's1', termId: 't1', total: 100, amountPaid: 0, balance: 100 }),
      inv({ id: 'i2', studentId: 's1', termId: 't1', total: 100, amountPaid: 0, balance: 100 }),
      inv({ id: 'i3', studentId: 's2', termId: 't1', total: 100, amountPaid: 0, balance: 100 }),
    ]
    const report = aggregateByTerm(invoices, termList, noFilters)
    expect(report.data[0]!.studentCount).toBe(2)
    expect(report.data[0]!.invoiceCount).toBe(3)
  })

  it('returns an empty report for no invoices', () => {
    const report = aggregateByTerm([], termList, noFilters)
    expect(report.data).toEqual([])
    expect(report.totals).toEqual({
      billed: 0,
      collected: 0,
      outstanding: 0,
      invoiceCount: 0,
    })
  })
})
