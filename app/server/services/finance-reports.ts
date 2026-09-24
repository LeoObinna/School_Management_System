/**
 * Expanded financial reports (README §41, Phase 14D).
 *
 * School-wide staff-only breakdowns of billed/collected/outstanding
 * money (INTEGER kobo) by fee purpose, class and term. Read-only;
 * nothing here mutates state.
 *
 * Invoices in scope have status issued / partially_paid / paid
 * (drafts and voided are excluded), mirroring financeSummary.
 *
 * Fee-purpose nuance: payments are recorded against an invoice, not a
 * line item, so money collected is allocated to purposes in
 * proportion to each line's share of the invoice total using a
 * largest-remainder split (exact to the kobo — allocations always sum
 * to amountPaid). Per-purpose "billed" is the gross line charge
 * (subtotal) and therefore excludes invoice-level discount/tax; the
 * class/term breakdowns use the invoice totals that include them.
 */
import { and, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm'
import {
  classes,
  feeItems,
  invoiceItems,
  studentEnrollments,
  studentInvoices,
  terms,
} from '../../database/schema'
import type {
  FinanceByClassReport,
  FinanceByClassRow,
  FinanceByTermReport,
  FinanceByTermRow,
  FinanceFeePurposeReport,
  FinanceFeePurposeRow,
  InvoiceStatus,
} from '../../shared/types'
import type {
  FinanceByClassReportQuery,
  FinanceByTermReportQuery,
  FinanceFeePurposeReportQuery,
} from '../../shared/schemas'
import type { SmsDb } from '../utils/pagination'
import { smsForbidden } from '../utils/http-errors'
import { getFinanceActor, type FinanceActor } from './finance'
import type { AuthContext } from '../utils/auth/context'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const SCOPED_STATUSES: InvoiceStatus[] = [
  'issued',
  'partially_paid',
  'paid',
]

// ---------------------------------------------------------------------------
// Pure reducer inputs
// ---------------------------------------------------------------------------

export interface ScopedInvoice {
  id: string
  studentId: string
  sessionId: string
  termId: string | null
  total: number
  amountPaid: number
  balance: number
}

export interface ScopedLine {
  invoiceId: string
  purpose: string
  lineTotal: number
}

export interface ScopedEnrollment {
  studentId: string
  sessionId: string
  classId: string
}

export interface ClassMeta {
  id: string
  name: string
  sequence: number
}

export interface TermMeta {
  id: string
  sessionId: string
  name: string
  sequence: number
  startDate: string | null
}

export const UNASSIGNED_CLASS = 'Unassigned'
export const UNASSIGNED_TERM = 'Unassigned term'

// ---------------------------------------------------------------------------
// Pure math: largest-remainder allocation of an invoice-level amount
// across its lines, weighted by lineTotal. Returns allocations (kobo)
// that sum EXACTLY to `amount` when amount <= totalWeight.
// ---------------------------------------------------------------------------

export function allocateAcrossLines(
  lineTotals: readonly number[],
  amount: number,
): number[] {
  const totalWeight = lineTotals.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) {
    // Nothing to weight against; cannot attribute payment to a line.
    return lineTotals.map(() => 0)
  }
  const exact = lineTotals.map((w) => (amount * w) / totalWeight)
  const floors = exact.map((v) => Math.floor(v))
  let remainder = amount - floors.reduce((a, b) => a + b, 0)
  // Hand out the remaining kobo to lines with the largest fractional
  // parts; ties break by line index for determinism.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const result = [...floors]
  let k = 0
  while (remainder > 0 && order.length > 0) {
    result[order[k % order.length]!.i]! += 1
    remainder--
    k++
  }
  return result
}

interface PurposeAccumulator extends FinanceFeePurposeRow {
  invoiceIds: Set<string>
}

export function aggregateFeePurposes(
  invoices: readonly ScopedInvoice[],
  lines: readonly ScopedLine[],
  filters: FinanceFeePurposeReport['filters'],
): FinanceFeePurposeReport {
  const byPurpose = new Map<string, PurposeAccumulator>()

  for (const inv of invoices) {
    const invLines = lines.filter((l) => l.invoiceId === inv.id)
    if (invLines.length === 0) continue
    const collectedPerLine = allocateAcrossLines(
      invLines.map((l) => l.lineTotal),
      inv.amountPaid,
    )
    invLines.forEach((line, idx) => {
      let acc = byPurpose.get(line.purpose)
      if (!acc) {
        acc = {
          purpose: line.purpose,
          lineCount: 0,
          invoiceCount: 0,
          billed: 0,
          collected: 0,
          outstanding: 0,
          invoiceIds: new Set<string>(),
        }
        byPurpose.set(line.purpose, acc)
      }
      const collected = collectedPerLine[idx] ?? 0
      acc.lineCount += 1
      acc.billed += line.lineTotal
      acc.collected += collected
      // Outstanding derives from billed/collected so each row balances
      // exactly even under invoice-level discount/tax.
      acc.outstanding += Math.max(0, line.lineTotal - collected)
      acc.invoiceIds.add(inv.id)
    })
  }

  const data: FinanceFeePurposeRow[] = [...byPurpose.values()]
    .map(({ invoiceIds, ...row }) => ({
      ...row,
      invoiceCount: invoiceIds.size,
    }))
    .sort((a, b) => b.billed - a.billed || a.purpose.localeCompare(b.purpose))

  return {
    filters,
    totals: {
      billed: data.reduce((s, r) => s + r.billed, 0),
      collected: data.reduce((s, r) => s + r.collected, 0),
      outstanding: data.reduce((s, r) => s + r.outstanding, 0),
      invoiceCount: invoices.length,
    },
    data,
  }
}

// Resolve one class per (student, session); deterministic preference
// for the lowest class id when data has duplicate active enrollments.
export function resolveStudentSessionClass(
  enrollments: readonly ScopedEnrollment[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of enrollments) {
    const key = `${e.studentId}|${e.sessionId}`
    const current = map.get(key)
    if (current === undefined || e.classId < current) {
      map.set(key, e.classId)
    }
  }
  return map
}

type ClassAccumulator = FinanceByClassRow & { studentIds: Set<string> }
type TermAccumulator = FinanceByTermRow & { studentIds: Set<string> }

export function aggregateByClass(
  invoices: readonly ScopedInvoice[],
  enrollments: readonly ScopedEnrollment[],
  classList: readonly ClassMeta[],
  filters: FinanceByClassReport['filters'],
): FinanceByClassReport {
  const classOf = resolveStudentSessionClass(enrollments)
  const className = new Map(classList.map((c) => [c.id, c.name]))

  const rows = new Map<string, ClassAccumulator>()
  for (const inv of invoices) {
    const classId = classOf.get(`${inv.studentId}|${inv.sessionId}`) ?? null
    const key = classId ?? '__unassigned__'
    let row = rows.get(key)
    if (!row) {
      row = {
        classId,
        className:
          classId ? (className.get(classId) ?? UNASSIGNED_CLASS) : UNASSIGNED_CLASS,
        invoiceCount: 0,
        studentCount: 0,
        billed: 0,
        collected: 0,
        outstanding: 0,
        studentIds: new Set<string>(),
      }
      rows.set(key, row)
    }
    row.invoiceCount += 1
    row.billed += inv.total
    row.collected += inv.amountPaid
    row.outstanding += inv.balance
    row.studentIds.add(inv.studentId)
  }

  const data: FinanceByClassRow[] = [...rows.values()]
    .map(({ studentIds, ...r }) => ({ ...r, studentCount: studentIds.size }))
    .sort((a, b) => {
      if (a.classId === null) return 1
      if (b.classId === null) return -1
      return a.className.localeCompare(b.className)
    })

  return { filters, totals: invoiceTotals(invoices), data }
}

export function aggregateByTerm(
  invoices: readonly ScopedInvoice[],
  termList: readonly TermMeta[],
  filters: FinanceByTermReport['filters'],
): FinanceByTermReport {
  const termOf = new Map(termList.map((t) => [t.id, t]))
  const rows = new Map<string, TermAccumulator>()

  for (const inv of invoices) {
    const key = inv.termId ?? '__unassigned__'
    let row = rows.get(key)
    if (!row) {
      const meta = inv.termId ? termOf.get(inv.termId) : undefined
      row = {
        termId: inv.termId,
        termName: meta?.name ?? UNASSIGNED_TERM,
        invoiceCount: 0,
        studentCount: 0,
        billed: 0,
        collected: 0,
        outstanding: 0,
        studentIds: new Set<string>(),
      }
      rows.set(key, row)
    }
    row.invoiceCount += 1
    row.billed += inv.total
    row.collected += inv.amountPaid
    row.outstanding += inv.balance
    row.studentIds.add(inv.studentId)
  }

  const sortKey = (t: TermMeta): string =>
    `${t.startDate ?? '9999-12-31'}|${String(t.sequence).padStart(4, '0')}`
  const data: FinanceByTermRow[] = [...rows.values()]
    .map(({ studentIds, ...r }) => ({ ...r, studentCount: studentIds.size }))
    .sort((a, b) => {
      if (a.termId === null) return 1
      if (b.termId === null) return -1
      const ta = termOf.get(a.termId!)
      const tb = termOf.get(b.termId!)
      if (!ta || !tb) return a.termName.localeCompare(b.termName)
      const ka = sortKey(ta)
      const kb = sortKey(tb)
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })

  return { filters, totals: invoiceTotals(invoices), data }
}

function invoiceTotals(invoices: readonly ScopedInvoice[]) {
  return {
    billed: invoices.reduce((s, i) => s + i.total, 0),
    collected: invoices.reduce((s, i) => s + i.amountPaid, 0),
    outstanding: invoices.reduce((s, i) => s + i.balance, 0),
    invoiceCount: invoices.length,
  }
}

// ---------------------------------------------------------------------------
// DB access
// ---------------------------------------------------------------------------

function assertStaff(actor: FinanceActor) {
  if (!actor.isStaff) throw smsForbidden()
}

function invoiceConditions(
  query: { sessionId?: string; termId?: string; classId?: string },
  client: SmsDb,
): SQL[] {
  const where: SQL[] = [inArray(studentInvoices.status, SCOPED_STATUSES)]
  if (query.sessionId) {
    where.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) {
    where.push(eq(studentInvoices.termId, query.termId))
  }
  if (query.classId) {
    // Restrict to students ACTIVE in that class for the invoice's own
    // session (same correlation shape as listOutstanding).
    const classStudentIds = client
      .select({ id: studentEnrollments.studentId })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.classId, query.classId),
          eq(studentEnrollments.sessionId, studentInvoices.sessionId),
          eq(studentEnrollments.status, 'active'),
        ),
      )
    where.push(inArray(studentInvoices.studentId, classStudentIds))
  }
  return where
}

async function fetchScopedInvoices(
  client: SmsDb,
  query: { sessionId?: string; termId?: string; classId?: string },
): Promise<ScopedInvoice[]> {
  const rows = await client
    .select({
      id: studentInvoices.id,
      studentId: studentInvoices.studentId,
      sessionId: studentInvoices.sessionId,
      termId: studentInvoices.termId,
      total: studentInvoices.total,
      amountPaid: studentInvoices.amountPaid,
      balance: studentInvoices.balance,
    })
    .from(studentInvoices)
    .where(and(...invoiceConditions(query, client)))

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    sessionId: r.sessionId,
    termId: r.termId,
    total: Number(r.total),
    amountPaid: Number(r.amountPaid),
    balance: Number(r.balance),
  }))
}

async function fetchScopedLines(
  client: SmsDb,
  invoiceIds: readonly string[],
): Promise<ScopedLine[]> {
  if (invoiceIds.length === 0) return []
  const rows = await client
    .select({
      invoiceId: invoiceItems.invoiceId,
      lineTotal: invoiceItems.lineTotal,
      purpose: sql`coalesce(${feeItems.name}, ${invoiceItems.description})`,
    })
    .from(invoiceItems)
    .leftJoin(feeItems, eq(invoiceItems.feeItemId, feeItems.id))
    .where(inArray(invoiceItems.invoiceId, invoiceIds as string[]))
  return rows.map((r) => ({
    invoiceId: r.invoiceId,
    purpose: String(r.purpose),
    lineTotal: Number(r.lineTotal),
  }))
}

async function fetchActiveEnrollments(
  client: SmsDb,
  sessionIds: readonly string[],
): Promise<ScopedEnrollment[]> {
  if (sessionIds.length === 0) return []
  const rows = await client
    .select({
      studentId: studentEnrollments.studentId,
      sessionId: studentEnrollments.sessionId,
      classId: studentEnrollments.classId,
    })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.status, 'active'),
        inArray(studentEnrollments.sessionId, sessionIds as string[]),
        isNotNull(studentEnrollments.classId),
      ),
    )
  return rows
    .filter((r) => r.classId !== null)
    .map((r) => ({
      studentId: r.studentId,
      sessionId: r.sessionId,
      classId: r.classId as string,
    }))
}

async function fetchClassMeta(client: SmsDb): Promise<ClassMeta[]> {
  const rows = await client
    .select({ id: classes.id, name: classes.name, sequence: classes.sequence })
    .from(classes)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sequence: Number(r.sequence),
  }))
}

async function fetchTermMeta(
  client: SmsDb,
  termIds: readonly string[],
): Promise<TermMeta[]> {
  if (termIds.length === 0) return []
  const rows = await client
    .select({
      id: terms.id,
      sessionId: terms.sessionId,
      name: terms.name,
      sequence: terms.sequence,
      startDate: terms.startDate,
    })
    .from(terms)
    .where(inArray(terms.id, termIds as string[]))
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    name: r.name,
    sequence: Number(r.sequence),
    startDate: r.startDate,
  }))
}

// ---------------------------------------------------------------------------
// Public report functions
// ---------------------------------------------------------------------------

export async function getFeePurposeReport(
  query: FinanceFeePurposeReportQuery,
  auth: AuthContext,
): Promise<FinanceFeePurposeReport> {
  const actor = await getFinanceActor(auth)
  assertStaff(actor)
  const client = await db()
  const invoices = await fetchScopedInvoices(client, query)
  const lines = await fetchScopedLines(
    client,
    invoices.map((i) => i.id),
  )
  return aggregateFeePurposes(invoices, lines, {
    sessionId: query.sessionId ?? null,
    termId: query.termId ?? null,
    classId: query.classId ?? null,
  })
}

export async function getByClassReport(
  query: FinanceByClassReportQuery,
  auth: AuthContext,
): Promise<FinanceByClassReport> {
  const actor = await getFinanceActor(auth)
  assertStaff(actor)
  const client = await db()
  const invoices = await fetchScopedInvoices(client, query)
  const sessionIds = [...new Set(invoices.map((i) => i.sessionId))]
  const [enrollments, classList] = await Promise.all([
    fetchActiveEnrollments(client, sessionIds),
    fetchClassMeta(client),
  ])
  return aggregateByClass(invoices, enrollments, classList, {
    sessionId: query.sessionId ?? null,
    termId: query.termId ?? null,
    classId: null,
  })
}

export async function getByTermReport(
  query: FinanceByTermReportQuery,
  auth: AuthContext,
): Promise<FinanceByTermReport> {
  const actor = await getFinanceActor(auth)
  assertStaff(actor)
  const client = await db()
  const invoices = await fetchScopedInvoices(client, query)
  const termIds = [
    ...new Set(
      invoices.map((i) => i.termId).filter((t): t is string => t !== null),
    ),
  ]
  const termList = await fetchTermMeta(client, termIds)
  return aggregateByTerm(invoices, termList, {
    sessionId: query.sessionId ?? null,
    termId: null,
    classId: query.classId ?? null,
  })
}
