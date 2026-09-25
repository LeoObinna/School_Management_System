/**
 * Finance domain service (README §19, D1 Phase 4b).
 *
 * Fee Structure -> Fee Items -> Invoice -> Invoice Items -> Payment
 * -> Verification -> Receipt.
 *
 * All money is INTEGER kobo (₦1 = 100 kobo) on D1/SQLite, transported
 * and computed as integer kobo end-to-end so no binary float ever
 * touches a fee. Payments are never trusted from the browser: recorded
 * payments start `pending` and only affect an invoice after an explicit
 * verify step (manual reconciliation in Phase 8; gateway webhooks come
 * later but provider_reference/idempotency_key are already reserved).
 */
import { and, asc, desc, eq, inArray, isNull, like, sql, type SQL } from 'drizzle-orm'
import {
  chunkRows,
  runBatch,
  type D1BatchItem,
  type SmsDb,
} from '../utils/pagination'
import {
  smsConflict,
  smsFieldError,
  smsForbidden,
  smsNotFound,
  isUniqueViolation,
} from '../utils/http-errors'
import { toJsonList, toJsonModel } from '../utils/serialize'
import {
  academicSessions,
  classes,
  feeItems,
  feeStructures,
  invoiceItems,
  parents,
  paymentReceipts,
  payments,
  studentEnrollments,
  studentInvoices,
  studentParents,
  students,
  terms,
} from '../../database/schema'
import type {
  FeeItemInput,
  FeeStructureCreate,
  FeeStructureListQuery,
  FeeStructureUpdate,
  FinanceSummaryQuery,
  InvoiceCreate,
  InvoiceListQuery,
  InvoiceUpdate,
  OutstandingQuery,
  PaymentCreate,
  PaymentListQuery,
  PaymentRefund,
  PaymentVerify,
} from '../../shared/schemas'
import type {
  FeeStructureDetail,
  FeeItem,
  FinanceSummary,
  InvoiceDetail,
  InvoiceListItem,
  InvoicePaymentSummary,
  InvoiceStatus,
  OutstandingRow,
  PaymentDetail,
  PaymentListItem,
  PaymentMethod,
  PaymentReceipt,
} from '../../shared/types'
import {
  koboToNaira,
  multiplyKobo,
  sumKobo,
} from '../../shared/utils/money'
import type { AuthContext } from '../utils/auth/context'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

export interface FinanceActor {
  userId: string
  isAdmin: boolean
  isStaff: boolean
  canVerify: boolean
  parentId: string | null
  childIds: string[]
}

const STAFF_PERMISSIONS = [
  'fees.manage_structure',
  'invoices.create',
  'invoices.update',
  'payments.record',
  'payments.verify',
  'payments.refund',
  'receipts.generate',
  'finance.export',
]

export async function getFinanceActor(
  auth: AuthContext,
): Promise<FinanceActor> {
  const roleSet = new Set(auth.roles)
  const isAdmin = roleSet.has('super_admin') || roleSet.has('admin')
  const isStaff =
    isAdmin ||
    STAFF_PERMISSIONS.some((p) => auth.permissions.includes(p))
  const canVerify =
    isAdmin || auth.permissions.includes('payments.verify')

  let parentId: string | null = null
  let childIds: string[] = []
  if (!isStaff) {
    const client = await db()
    const [parentRow] = await client
      .select({ id: parents.id })
      .from(parents)
      .where(
        and(eq(parents.userId, auth.user.id), isNull(parents.deletedAt)),
      )
      .limit(1)
    if (parentRow) {
      const pid = parentRow.id
      parentId = pid
      const links = await client
        .select({ studentId: studentParents.studentId })
        .from(studentParents)
        .where(eq(studentParents.parentId, pid))
      childIds = links.map((l) => l.studentId)
    }
  }

  return { userId: auth.user.id, isAdmin, isStaff, canVerify, parentId, childIds }
}

function assertStaff(actor: FinanceActor): void {
  if (!actor.isStaff) {
    throw smsForbidden()
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const activeStudent = isNull(students.deletedAt)
const PARENT_VISIBLE_INVOICE_STATUSES: InvoiceStatus[] = [
  'issued',
  'partially_paid',
  'paid',
]
const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  'issued',
  'partially_paid',
]

function isInvoiceOverdue(
  dueDate: string | null,
  balanceKobo: number,
  status: InvoiceStatus,
): boolean {
  if (!dueDate || balanceKobo <= 0) return false
  if (status === 'draft' || status === 'void' || status === 'paid') {
    return false
  }
  const due = new Date(`${dueDate}T23:59:59`).getTime()
  return Number.isFinite(due) && due < Date.now()
}

async function validateSessionTerm(
  client: SmsDb,
  sessionId: string,
  termId?: string | null,
): Promise<void> {
  const [session] = await client
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, sessionId))
    .limit(1)
  if (!session) {
    throw smsFieldError('sessionId', 'Academic session not found.')
  }
  if (termId) {
    const [term] = await client
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.id, termId), eq(terms.sessionId, sessionId)))
      .limit(1)
    if (!term) {
      throw smsFieldError('termId', 'Term not found in this session.')
    }
  }
}

async function getActiveStudent(
  client: SmsDb,
  studentId: string,
) {
  const [row] = await client
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    })
    .from(students)
    .where(and(eq(students.id, studentId), activeStudent))
    .limit(1)
  if (!row) {
    throw smsFieldError('studentId', 'Student not found.')
  }
  return row
}

// Sequential, human-readable document numbers, counted BEFORE the
// write batch. D1 serialises writes and the unique index backstops the
// count; a collision (concurrent numbering) is retried by the caller.
async function allocateNumber(
  client: SmsDb,
  prefix: 'INV' | 'PAY' | 'RCT',
): Promise<string> {
  const year = new Date().getFullYear()
  const pattern = `${prefix}-${year}-%`
  const sources = {
    INV: {
      table: studentInvoices,
      column: studentInvoices.invoiceNumber,
    },
    PAY: { table: payments, column: payments.paymentReference },
    RCT: {
      table: paymentReceipts,
      column: paymentReceipts.receiptNumber,
    },
  } as const
  const source = sources[prefix]
  const rows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(source.table)
    .where(like(source.column, pattern))
  const n = (Number(rows[0]?.n) || 0) + 1
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`
}

// drizzle's and() is typed as SQL | undefined; collapse to SQL.
function all(conditions: Array<SQL | undefined>): SQL {
  return and(...conditions) ?? sql`true`
}

// Builds a D1 batch around a freshly-allocated document number and runs
// it atomically, retrying the WHOLE number+batch cycle on a unique-index
// collision (e.g. concurrent numbering).
async function runDocNumberBatch(
  client: SmsDb,
  prefix: 'INV' | 'PAY' | 'RCT',
  build: (number: string) => D1BatchItem[],
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await allocateNumber(client, prefix)
    try {
      await runBatch(client, build(number))
      return
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) {
        continue
      }
      throw error
    }
  }
  throw smsConflict('Could not allocate a unique document number.')
}

// Returns a batch statement that inserts a receipt for `paymentId`
// (allocating the RCT number), or null when a receipt already exists.
// The existence read runs before the batch because D1 batches cannot
// branch on query results. issuedById is null for system-triggered
// receipts (Phase 15 gateway verification).
async function receiptInsert(
  client: SmsDb,
  paymentId: string,
  issuedById: string | null,
): Promise<D1BatchItem | null> {
  const [existing] = await client
    .select({ id: paymentReceipts.id })
    .from(paymentReceipts)
    .where(eq(paymentReceipts.paymentId, paymentId))
    .limit(1)
  if (existing) return null
  const receiptNumber = await allocateNumber(client, 'RCT')
  // Cast off the thenable surface: in a batch this is a statement, not a
  // promise to await.
  return client
    .insert(paymentReceipts)
    .values({ receiptNumber, paymentId, issuedById }) as unknown as D1BatchItem
}

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------

async function structureItems(
  client: SmsDb,
  structureId: string,
): Promise<FeeItem[]> {
  const rows = await client
    .select()
    .from(feeItems)
    .where(eq(feeItems.feeStructureId, structureId))
    .orderBy(asc(feeItems.name))
  return toJsonList<FeeItem>(rows)
}

// sessionId -> classIds the actor's children actively attend.
async function parentClassScope(
  client: SmsDb,
  actor: FinanceActor,
): Promise<Map<string, Set<string>>> {
  const scope = new Map<string, Set<string>>()
  if (actor.childIds.length === 0) return scope
  const rows = await client
    .select({
      sessionId: studentEnrollments.sessionId,
      classId: studentEnrollments.classId,
    })
    .from(studentEnrollments)
    .where(
      and(
        inArray(studentEnrollments.studentId, actor.childIds),
        eq(studentEnrollments.status, 'active'),
      ),
    )
  for (const r of rows) {
    if (!scope.has(r.sessionId)) scope.set(r.sessionId, new Set())
    scope.get(r.sessionId)!.add(r.classId)
  }
  return scope
}

export async function listFeeStructures(
  query: FeeStructureListQuery,
  actor: FinanceActor,
): Promise<{ data: FeeStructureDetail[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) where.push(eq(feeStructures.sessionId, query.sessionId))
  if (query.classId) where.push(eq(feeStructures.classId, query.classId))
  if (query.isActive !== undefined) {
    where.push(eq(feeStructures.isActive, query.isActive))
  }
  const rows = await client
    .select({
      structure: feeStructures,
      sessionName: academicSessions.name,
      className: classes.name,
    })
    .from(feeStructures)
    .innerJoin(
      academicSessions,
      eq(feeStructures.sessionId, academicSessions.id),
    )
    .leftJoin(classes, eq(feeStructures.classId, classes.id))
    .where(all(where))
    .orderBy(desc(feeStructures.createdAt))
    .limit(200)

  const classScope = actor.isStaff
    ? null
    : await parentClassScope(client, actor)

  const details: FeeStructureDetail[] = []
  for (const r of rows) {
    if (!actor.isStaff && r.structure.classId) {
      // Parents may only see structures applying to their children's
      // classes (plus class-wide ones, handled by the null branch).
      const allowed = classScope?.get(r.structure.sessionId)
      if (!allowed?.has(r.structure.classId)) continue
    }
    details.push({
      ...toJsonModel<FeeStructureDetail>(r.structure),
      sessionName: r.sessionName,
      className: r.className,
      items: await structureItems(client, r.structure.id),
    })
  }
  return { data: details }
}

export async function getFeeStructure(
  id: string,
  actor: FinanceActor,
): Promise<FeeStructureDetail> {
  const client = await db()
  const [row] = await client
    .select({
      structure: feeStructures,
      sessionName: academicSessions.name,
      className: classes.name,
    })
    .from(feeStructures)
    .innerJoin(
      academicSessions,
      eq(feeStructures.sessionId, academicSessions.id),
    )
    .leftJoin(classes, eq(feeStructures.classId, classes.id))
    .where(eq(feeStructures.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Fee structure not found.')
  }
  if (!actor.isStaff && row.structure.classId) {
    const scope = await parentClassScope(client, actor)
    const allowed = scope.get(row.structure.sessionId)
    if (!allowed?.has(row.structure.classId)) {
      throw smsNotFound('Fee structure not found.')
    }
  }
  return {
    ...toJsonModel<FeeStructureDetail>(row.structure),
    sessionName: row.sessionName,
    className: row.className,
    items: await structureItems(client, id),
  }
}

export async function createFeeStructure(
  input: FeeStructureCreate,
): Promise<FeeStructureDetail> {
  const client = await db()
  await validateSessionTerm(client, input.sessionId)
  if (input.classId) {
    const [cls] = await client
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, input.classId))
      .limit(1)
    if (!cls) throw smsFieldError('classId', 'Class not found.')
  }
  // D1 batch: fee structure (app-generated id) + child fee items.
  const structureId = crypto.randomUUID()
  // 6 bound columns per item row; D1 caps at 100 binds/statement.
  const itemInserts = chunkRows(input.items, 6).map((chunk) => {
    const insert = client.insert(feeItems)
    return insert.values(
      chunk.map((i: FeeItemInput) => ({
        feeStructureId: structureId,
        name: i.name,
        description: i.description ?? null,
        amount: i.amount,
        isOptional: i.isOptional ?? false,
        dueDate: i.dueDate ?? null,
      })),
    )
  })
  await client.batch([
    client.insert(feeStructures).values({
      id: structureId,
      sessionId: input.sessionId,
      classId: input.classId ?? null,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
    }),
    ...itemInserts,
  ])
  return getFeeStructure(structureId, {
    userId: '',
    isAdmin: true,
    isStaff: true,
    canVerify: true,
    parentId: null,
    childIds: [],
  })
}

export async function updateFeeStructure(
  id: string,
  input: FeeStructureUpdate,
): Promise<FeeStructureDetail> {
  const client = await db()
  const [existing] = await client
    .select()
    .from(feeStructures)
    .where(eq(feeStructures.id, id))
    .limit(1)
  if (!existing) throw smsNotFound('Fee structure not found.')

  if (input.sessionId) await validateSessionTerm(client, input.sessionId)
  if (input.classId) {
    const [cls] = await client
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, input.classId))
      .limit(1)
    if (!cls) throw smsFieldError('classId', 'Class not found.')
  }

  const values: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (input.sessionId !== undefined) values.sessionId = input.sessionId
  if (input.classId !== undefined) values.classId = input.classId
  if (input.name !== undefined) values.name = input.name
  if (input.description !== undefined) {
    values.description = input.description
  }
  if (input.isActive !== undefined) values.isActive = input.isActive
  const statements: D1BatchItem[] = [
    client
      .update(feeStructures)
      .set(values)
      .where(eq(feeStructures.id, id)),
  ]
  if (input.items) {
    statements.push(
      client.delete(feeItems).where(eq(feeItems.feeStructureId, id)),
    )
    // 6 bound columns per item row; D1 caps at 100 binds/statement.
    for (const chunk of chunkRows(input.items, 6)) {
      const insert = client.insert(feeItems)
      statements.push(
        insert.values(
          chunk.map((i) => ({
            feeStructureId: id,
            name: i.name,
            description: i.description ?? null,
            amount: i.amount,
            isOptional: i.isOptional ?? false,
            dueDate: i.dueDate ?? null,
          })),
        ),
      )
    }
  }
  await runBatch(client, statements)
  return getFeeStructure(id, {
    userId: '',
    isAdmin: true,
    isStaff: true,
    canVerify: true,
    parentId: null,
    childIds: [],
  })
}

export async function addFeeItem(
  structureId: string,
  input: FeeItemInput,
): Promise<FeeStructureDetail> {
  const client = await db()
  const [structure] = await client
    .select({ id: feeStructures.id })
    .from(feeStructures)
    .where(eq(feeStructures.id, structureId))
    .limit(1)
  if (!structure) throw smsNotFound('Fee structure not found.')
  await client.insert(feeItems).values({
    feeStructureId: structureId,
    name: input.name,
    description: input.description ?? null,
    amount: input.amount,
    isOptional: input.isOptional ?? false,
    dueDate: input.dueDate ?? null,
  })
  return getFeeStructure(structureId, {
    userId: '',
    isAdmin: true,
    isStaff: true,
    canVerify: true,
    parentId: null,
    childIds: [],
  })
}

export async function updateFeeItem(
  structureId: string,
  itemId: string,
  input: FeeItemInput,
): Promise<FeeStructureDetail> {
  const client = await db()
  const [item] = await client
    .select({ id: feeItems.id })
    .from(feeItems)
    .where(
      and(
        eq(feeItems.id, itemId),
        eq(feeItems.feeStructureId, structureId),
      ),
    )
    .limit(1)
  if (!item) throw smsNotFound('Fee item not found.')
  await client
    .update(feeItems)
    .set({
      name: input.name,
      description: input.description ?? null,
      amount: input.amount,
      isOptional: input.isOptional ?? false,
      dueDate: input.dueDate ?? null,
    })
    .where(eq(feeItems.id, itemId))
  return getFeeStructure(structureId, {
    userId: '',
    isAdmin: true,
    isStaff: true,
    canVerify: true,
    parentId: null,
    childIds: [],
  })
}

export async function deleteFeeItem(
  structureId: string,
  itemId: string,
): Promise<{ message: string }> {
  const client = await db()
  const deleted = await client
    .delete(feeItems)
    .where(
      and(
        eq(feeItems.id, itemId),
        eq(feeItems.feeStructureId, structureId),
      ),
    )
    .returning({ id: feeItems.id })
  if (deleted.length === 0) {
    throw smsNotFound('Fee item not found.')
  }
  return { message: 'Fee item removed.' }
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

interface JoinedInvoiceRow {
  invoice: typeof studentInvoices.$inferSelect
  firstName: string
  lastName: string
  admissionNumber: string
  sessionName: string
  termName: string | null
  className: string | null
}

async function invoiceJoinedQuery(
  client: SmsDb,
  where: SQL,
): Promise<JoinedInvoiceRow[]> {
  return client
    .select({
      invoice: studentInvoices,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
      sessionName: academicSessions.name,
      termName: terms.name,
      className: classes.name,
    })
    .from(studentInvoices)
    .innerJoin(students, eq(studentInvoices.studentId, students.id))
    .innerJoin(
      academicSessions,
      eq(studentInvoices.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(studentInvoices.termId, terms.id))
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.studentId, studentInvoices.studentId),
        eq(studentEnrollments.sessionId, studentInvoices.sessionId),
        eq(studentEnrollments.status, 'active'),
      ),
    )
    .leftJoin(classes, eq(studentEnrollments.classId, classes.id))
    .where(where)
}

function mapInvoiceRow(row: JoinedInvoiceRow): InvoiceListItem {
  const overdue = isInvoiceOverdue(
    row.invoice.dueDate,
    row.invoice.balance,
    row.invoice.status,
  )
  return {
    ...toJsonModel<InvoiceListItem>(row.invoice),
    studentName: `${row.firstName} ${row.lastName}`.trim(),
    admissionNumber: row.admissionNumber,
    className: row.className,
    sessionName: row.sessionName,
    termName: row.termName,
    overdue,
  }
}

export async function listInvoices(
  query: InvoiceListQuery,
  actor: FinanceActor,
): Promise<{ data: InvoiceListItem[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.sessionId) {
    where.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) where.push(eq(studentInvoices.termId, query.termId))
  if (query.studentId) {
    where.push(eq(studentInvoices.studentId, query.studentId))
  }
  if (query.status && query.status !== 'overdue') {
    where.push(eq(studentInvoices.status, query.status))
  }

  if (!actor.isStaff) {
    if (actor.childIds.length === 0) return { data: [] }
    where.push(inArray(studentInvoices.studentId, actor.childIds))
    where.push(
      inArray(studentInvoices.status, PARENT_VISIBLE_INVOICE_STATUSES),
    )
    if (query.studentId && !actor.childIds.includes(query.studentId)) {
      throw smsForbidden()
    }
  }

  const rows = await invoiceJoinedQuery(client, all(where))
  // Enrollment joins can duplicate an invoice; keep the first row with a
  // className and preserve the newest-first order.
  const seen = new Map<string, InvoiceListItem>()
  for (const r of rows) {
    const mapped = mapInvoiceRow(r)
    const existing = seen.get(mapped.id)
    if (!existing) {
      seen.set(mapped.id, mapped)
    } else if (!existing.className && mapped.className) {
      seen.set(mapped.id, { ...existing, className: mapped.className })
    }
  }
  let items = [...seen.values()]
  if (query.status === 'overdue') {
    items = items.filter((i) => i.overdue)
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return { data: items.slice(0, 500) }
}

async function loadInvoiceRow(
  client: SmsDb,
  id: string,
): Promise<JoinedInvoiceRow | null> {
  const rows = await invoiceJoinedQuery(client, eq(studentInvoices.id, id))
  return rows[0] ?? null
}

export async function getInvoice(
  id: string,
  actor: FinanceActor,
): Promise<InvoiceDetail> {
  const client = await db()
  const row = await loadInvoiceRow(client, id)
  if (!row) throw smsNotFound('Invoice not found.')

  if (
    !actor.isStaff &&
    (!actor.childIds.includes(row.invoice.studentId) ||
      !PARENT_VISIBLE_INVOICE_STATUSES.includes(row.invoice.status))
  ) {
    throw smsNotFound('Invoice not found.')
  }

  const [itemRows, paymentRows] = await Promise.all([
    client
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.createdAt)),
    client
      .select({
        id: payments.id,
        paymentReference: payments.paymentReference,
        amount: payments.amount,
        method: payments.method,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        receiptNumber: paymentReceipts.receiptNumber,
      })
      .from(payments)
      .leftJoin(
        paymentReceipts,
        eq(paymentReceipts.paymentId, payments.id),
      )
      .where(
        all([
          eq(payments.invoiceId, id),
          // Parents/students only see verified/refunded payments.
          actor.isStaff
            ? undefined
            : inArray(payments.status, ['verified', 'refunded']),
        ]),
      )
      .orderBy(desc(payments.createdAt)),
  ])

  return {
    ...mapInvoiceRow(row),
    items: toJsonList<InvoiceDetail['items'][number]>(itemRows),
    payments: toJsonList<InvoicePaymentSummary>(paymentRows),
  }
}

// Materialize line items from a fee structure (non-optional items by
// default; explicit feeItemIds overrides the selection).
async function itemsFromStructure(
  client: SmsDb,
  input: InvoiceCreate,
  studentId: string,
): Promise<
  { feeItemId: string; description: string; quantity: number; unitAmount: number }[]
> {
  const [structure] = await client
    .select()
    .from(feeStructures)
    .where(
      and(
        eq(feeStructures.id, input.feeStructureId!),
        eq(feeStructures.isActive, true),
      ),
    )
    .limit(1)
  if (!structure) {
    throw smsFieldError('feeStructureId', 'Fee structure not found.')
  }
  if (structure.classId) {
    const [enrollment] = await client
      .select({ id: studentEnrollments.id })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.studentId, studentId),
          eq(studentEnrollments.sessionId, input.sessionId),
          eq(studentEnrollments.classId, structure.classId),
          eq(studentEnrollments.status, 'active'),
        ),
      )
      .limit(1)
    if (!enrollment) {
      throw smsFieldError(
        'feeStructureId',
        'The student is not enrolled in the class this fee structure applies to.',
      )
    }
  }
  const rows = await client
    .select()
    .from(feeItems)
    .where(eq(feeItems.feeStructureId, structure.id))
  const selected = input.feeItemIds?.length
    ? rows.filter((r) => input.feeItemIds!.includes(r.id))
    : rows.filter((r) => !r.isOptional)
  if (selected.length === 0) {
    throw smsFieldError('feeItemIds', 'No fee items selected.')
  }
  return selected.map((r) => ({
    feeItemId: r.id,
    description: r.name,
    quantity: 1,
    unitAmount: r.amount,
  }))
}

interface PreparedLine {
  feeItemId: string | null
  description: string
  quantity: number
  unitAmount: number
  lineTotal: number
}

function prepareLines(
  raw: {
    feeItemId?: string
    description: string
    quantity?: number
    unitAmount: number
  }[],
): PreparedLine[] {
  return raw.map((i) => {
    const quantity = i.quantity ?? 1
    return {
      feeItemId: i.feeItemId ?? null,
      description: i.description,
      quantity,
      unitAmount: i.unitAmount,
      lineTotal: multiplyKobo(i.unitAmount, quantity),
    }
  })
}

function invoiceTotals(
  lines: PreparedLine[],
  discount: number,
  tax: number,
): { subtotal: number; total: number } {
  const subtotal = sumKobo(...lines.map((l) => l.lineTotal))
  if (discount > subtotal) {
    throw smsFieldError('discount', 'Discount cannot exceed the subtotal.')
  }
  const total = subtotal - discount + tax
  if (total < 0) {
    throw smsFieldError('tax', 'Invoice total cannot be negative.')
  }
  return { subtotal, total }
}

export async function createInvoice(
  input: InvoiceCreate,
  actor: FinanceActor,
): Promise<InvoiceDetail> {
  assertStaff(actor)
  const client = await db()
  await getActiveStudent(client, input.studentId)
  await validateSessionTerm(client, input.sessionId, input.termId ?? null)

  const rawLines = input.feeStructureId
    ? await itemsFromStructure(client, input, input.studentId)
    : input.items ?? []
  const lines = prepareLines(rawLines)
  const totals = invoiceTotals(
    lines,
    input.discount ?? 0,
    input.tax ?? 0,
  )

  const invoiceId = crypto.randomUUID()
  // 6 bound columns per invoice line; D1 caps at 100 binds/statement.
  const lineInserts = chunkRows(lines, 6).map((chunk) => {
    const insert = client.insert(invoiceItems)
    return insert.values(
      chunk.map((l) => ({
        invoiceId,
        feeItemId: l.feeItemId,
        description: l.description,
        quantity: l.quantity,
        unitAmount: l.unitAmount,
        lineTotal: l.lineTotal,
      })),
    )
  })
  await runDocNumberBatch(client, 'INV', (invoiceNumber) => {
    const headerValues = {
      id: invoiceId,
      invoiceNumber,
      studentId: input.studentId,
      sessionId: input.sessionId,
      termId: input.termId ?? null,
      issueDate: input.issueDate,
      dueDate: input.dueDate ?? null,
      subtotal: totals.subtotal,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      total: totals.total,
      amountPaid: 0,
      balance: totals.total,
      status: 'draft' as const,
      notes: input.notes ?? null,
      createdById: actor.userId,
    }
    const invoiceInsert = client.insert(studentInvoices)
    const header = invoiceInsert.values(headerValues)
    return [header, ...lineInserts]
  })
  return getInvoice(invoiceId, actor)
}

export async function updateInvoice(
  id: string,
  input: InvoiceUpdate,
  actor: FinanceActor,
): Promise<InvoiceDetail> {
  assertStaff(actor)
  const client = await db()
  const [existing] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, id))
    .limit(1)
  if (!existing) throw smsNotFound('Invoice not found.')
  if (existing.status !== 'draft') {
    throw smsConflict('Only draft invoices can be edited.')
  }

  let lines: PreparedLine[] | null = null
  if (input.items) {
    lines = prepareLines(input.items)
  } else {
    const rows = await client
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
    lines = prepareLines(
      rows.map((r) => ({
        feeItemId: r.feeItemId ?? undefined,
        description: r.description,
        quantity: r.quantity,
        unitAmount: r.unitAmount,
      })),
    )
  }

  const discount = input.discount ?? existing.discount
  const tax = input.tax ?? existing.tax
  const totals = invoiceTotals(lines, discount, tax)

  const statements: D1BatchItem[] = [
    client
      .update(studentInvoices)
      .set({
        termId:
          input.termId !== undefined ? input.termId : existing.termId,
        issueDate: input.issueDate ?? existing.issueDate,
        dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        discount,
        tax,
        subtotal: totals.subtotal,
        total: totals.total,
        balance: totals.total,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(studentInvoices.id, id)),
  ]
  if (input.items) {
    statements.push(
      client.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
    )
    // 6 bound columns per invoice line; D1 caps at 100 binds/statement.
    for (const chunk of chunkRows(input.items!, 6)) {
      const insert = client.insert(invoiceItems)
      statements.push(
        insert.values(
          chunk.map((i) => {
            const quantity = i.quantity ?? 1
            return {
              invoiceId: id,
              feeItemId: i.feeItemId ?? null,
              description: i.description,
              quantity,
              unitAmount: i.unitAmount,
              lineTotal: multiplyKobo(i.unitAmount, quantity),
            }
          }),
        ),
      )
    }
  }
  await runBatch(client, statements)
  return getInvoice(id, actor)
}

export async function issueInvoice(
  id: string,
  actor: FinanceActor,
): Promise<InvoiceDetail> {
  assertStaff(actor)
  const client = await db()
  const [existing] = await client
    .select({ id: studentInvoices.id, status: studentInvoices.status })
    .from(studentInvoices)
    .where(eq(studentInvoices.id, id))
    .limit(1)
  if (!existing) throw smsNotFound('Invoice not found.')
  if (existing.status !== 'draft') {
    throw smsConflict('Only draft invoices can be issued.')
  }
  await client
    .update(studentInvoices)
    .set({ status: 'issued', updatedAt: new Date().toISOString() })
    .where(eq(studentInvoices.id, id))
  return getInvoice(id, actor)
}

export async function voidInvoice(
  id: string,
  actor: FinanceActor,
): Promise<InvoiceDetail> {
  assertStaff(actor)
  const client = await db()
  const [existing] = await client
    .select({
      id: studentInvoices.id,
      status: studentInvoices.status,
      amountPaid: studentInvoices.amountPaid,
    })
    .from(studentInvoices)
    .where(eq(studentInvoices.id, id))
    .limit(1)
  if (!existing) throw smsNotFound('Invoice not found.')
  if (existing.status === 'void') {
    throw smsConflict('Invoice is already void.')
  }
  if (existing.status === 'paid') {
    throw smsConflict('Refund all payments before voiding a paid invoice.')
  }
  if (existing.amountPaid > 0) {
    throw smsConflict(
      'Invoice has recorded payments; refund them before voiding.',
    )
  }
  await client
    .update(studentInvoices)
    .set({ status: 'void', updatedAt: new Date().toISOString() })
    .where(eq(studentInvoices.id, id))
  return getInvoice(id, actor)
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function invoicePaymentStatus(
  balanceKobo: number,
  amountPaidKobo: number,
): InvoiceStatus {
  if (balanceKobo <= 0) return 'paid'
  return amountPaidKobo > 0 ? 'partially_paid' : 'issued'
}

export async function listPayments(
  query: PaymentListQuery,
  actor: FinanceActor,
): Promise<{ data: PaymentListItem[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.invoiceId) where.push(eq(payments.invoiceId, query.invoiceId))
  if (query.studentId) where.push(eq(payments.studentId, query.studentId))
  if (query.method) where.push(eq(payments.method, query.method))
  if (query.status) where.push(eq(payments.status, query.status))
  if (query.sessionId) {
    where.push(eq(studentInvoices.sessionId, query.sessionId))
  }

  if (!actor.isStaff) {
    if (actor.childIds.length === 0) return { data: [] }
    where.push(inArray(payments.studentId, actor.childIds))
    where.push(inArray(payments.status, ['verified', 'refunded']))
    if (query.studentId && !actor.childIds.includes(query.studentId)) {
      throw smsForbidden()
    }
  }

  const rows = await client
    .select({
      payment: payments,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
      invoiceNumber: studentInvoices.invoiceNumber,
      receiptNumber: paymentReceipts.receiptNumber,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(studentInvoices, eq(payments.invoiceId, studentInvoices.id))
    .leftJoin(paymentReceipts, eq(paymentReceipts.paymentId, payments.id))
    .where(all(where))
    .orderBy(desc(payments.createdAt))
    .limit(500)

  return {
    data: rows.map((r) => ({
      ...toJsonModel<PaymentListItem>(r.payment),
      studentName: `${r.firstName} ${r.lastName}`.trim(),
      admissionNumber: r.admissionNumber,
      invoiceNumber: r.invoiceNumber,
      receiptNumber: r.receiptNumber,
    })),
  }
}

export async function getPayment(
  id: string,
  actor: FinanceActor,
): Promise<PaymentDetail> {
  const client = await db()
  const [row] = await client
    .select({
      payment: payments,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
      invoiceNumber: studentInvoices.invoiceNumber,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(studentInvoices, eq(payments.invoiceId, studentInvoices.id))
    .where(eq(payments.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Payment not found.')

  const [receiptRow] = await client
    .select()
    .from(paymentReceipts)
    .where(eq(paymentReceipts.paymentId, id))
    .limit(1)

  if (
    !actor.isStaff &&
    (!actor.childIds.includes(row.payment.studentId) ||
      !['verified', 'refunded'].includes(row.payment.status))
  ) {
    throw smsNotFound('Payment not found.')
  }

  return {
    ...toJsonModel<PaymentDetail>(row.payment),
    studentName: `${row.firstName} ${row.lastName}`.trim(),
    admissionNumber: row.admissionNumber,
    invoiceNumber: row.invoiceNumber,
    receipt: receiptRow ? toJsonModel<PaymentReceipt>(receiptRow) : null,
  }
}

export async function getPaymentReceipt(
  paymentId: string,
  actor: FinanceActor,
): Promise<PaymentReceipt> {
  const client = await db()
  const [payment] = await client
    .select({
      id: payments.id,
      studentId: payments.studentId,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
  if (!payment) throw smsNotFound('Payment not found.')
  if (
    !actor.isStaff &&
    (!actor.childIds.includes(payment.studentId) ||
      !['verified', 'refunded'].includes(payment.status))
  ) {
    throw smsNotFound('Payment not found.')
  }
  const [receipt] = await client
    .select()
    .from(paymentReceipts)
    .where(eq(paymentReceipts.paymentId, paymentId))
    .limit(1)
  if (!receipt) throw smsNotFound('No receipt has been issued for this payment.')
  return toJsonModel<PaymentReceipt>(receipt)
}

export async function recordPayment(
  input: PaymentCreate,
  actor: FinanceActor,
): Promise<PaymentDetail> {
  assertStaff(actor)
  if (input.verifyImmediately && !actor.canVerify) {
    throw smsForbidden('You do not have permission to verify payments.')
  }
  const client = await db()
  const [invoice] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, input.invoiceId))
    .limit(1)
  if (!invoice) throw smsFieldError('invoiceId', 'Invoice not found.')
  if (!['issued', 'partially_paid'].includes(invoice.status)) {
    throw smsConflict(
      `Payments can only be recorded for issued or partially paid invoices (current: ${invoice.status}).`,
    )
  }
  const amountKobo = input.amount
  const balanceKobo = invoice.balance
  if (amountKobo > balanceKobo) {
    throw smsFieldError(
      'amount',
      `Amount exceeds the invoice balance of ${koboToNaira(balanceKobo)}.`,
    )
  }

  const verified = Boolean(input.verifyImmediately)
  const paymentId = crypto.randomUUID()
  // Receipt statement (with pre-allocated RCT number) is built BEFORE
  // the batch so it joins the same atomic write when auto-verifying.
  const receipt = verified
    ? await receiptInsert(client, paymentId, actor.userId)
    : null
  const amountPaidKobo = invoice.amountPaid + amountKobo
  const newBalanceKobo = invoice.total - amountPaidKobo
  await runDocNumberBatch(client, 'PAY', (reference) => {
    const paymentInsert = client.insert(payments)
    const paymentStatement = paymentInsert.values({
      id: paymentId,
      paymentReference: reference,
      invoiceId: input.invoiceId,
      studentId: invoice.studentId,
      amount: input.amount,
      method: input.method,
      status: verified ? 'verified' : 'pending',
      providerReference: input.providerReference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ? new Date(input.paidAt).toISOString() : new Date().toISOString(),
      verifiedAt: verified ? new Date().toISOString() : null,
      verifiedById: verified ? actor.userId : null,
    })
    const statements: D1BatchItem[] = [paymentStatement]
    if (verified) {
      statements.push(
        client
          .update(studentInvoices)
          .set({
            amountPaid: amountPaidKobo,
            balance: newBalanceKobo,
            status: invoicePaymentStatus(newBalanceKobo, amountPaidKobo),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(studentInvoices.id, invoice.id)),
      )
      if (receipt) statements.push(receipt)
    }
    return statements
  })
  return getPayment(paymentId, actor)
}

// System actor used for gateway-triggered writes (Phase 15): there is
// no staff user behind a Paystack webhook, so verifiedById stays null
// and read-back uses an internal full-access actor.
const SYSTEM_ACTOR: FinanceActor = {
  userId: '',
  isAdmin: true,
  isStaff: true,
  canVerify: true,
  parentId: null,
  childIds: [],
}

interface ApplyVerificationOptions {
  providerReference?: string | null
  notes?: string | null
  verifiedById: string | null
  webhookPayload?: string | null
}

// Shared pending → verified transition: updates the payment, applies
// the amount to the invoice and inserts the receipt, atomically.
// Permission/actor checks belong to the callers.
async function applyPaymentVerification(
  id: string,
  opts: ApplyVerificationOptions,
): Promise<PaymentDetail> {
  const client = await db()

  const [payment] = await client
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1)
  if (!payment) throw smsNotFound('Payment not found.')
  if (payment.status === 'verified') {
    throw smsConflict('Payment is already verified.')
  }
  if (payment.status !== 'pending') {
    throw smsConflict(
      `Only pending payments can be verified (current: ${payment.status}).`,
    )
  }
  const [invoice] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, payment.invoiceId))
    .limit(1)
  if (!invoice) throw smsNotFound('Invoice not found.')
  if (invoice.status === 'void') {
    throw smsConflict('Cannot verify a payment against a void invoice.')
  }
  const amountKobo = payment.amount
  const amountPaidKobo = invoice.amountPaid + amountKobo
  const newBalanceKobo = invoice.total - amountPaidKobo
  if (newBalanceKobo < 0) {
    throw smsConflict(
      'Verifying this payment would overpay the invoice.',
    )
  }

  // Receipt number is allocated before the batch; all three writes run
  // atomically together.
  const receipt = await receiptInsert(client, id, opts.verifiedById)
  const statements: D1BatchItem[] = [
    client
      .update(payments)
      .set({
        status: 'verified',
        providerReference:
          opts.providerReference !== undefined
            ? opts.providerReference
            : payment.providerReference,
        notes: opts.notes !== undefined ? opts.notes : payment.notes,
        webhookPayload:
          opts.webhookPayload !== undefined
            ? opts.webhookPayload
            : payment.webhookPayload,
        // Gateway payments are created with paidAt null (Phase 15);
        // manual payments carry paidAt from recording time.
        paidAt: payment.paidAt ?? new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        verifiedById: opts.verifiedById,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payments.id, id)),
    client
      .update(studentInvoices)
      .set({
        amountPaid: amountPaidKobo,
        balance: newBalanceKobo,
        status: invoicePaymentStatus(newBalanceKobo, amountPaidKobo),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(studentInvoices.id, invoice.id)),
  ]
  if (receipt) statements.push(receipt)
  await runBatch(client, statements)
  return getPayment(id, SYSTEM_ACTOR)
}

export async function verifyPayment(
  id: string,
  input: PaymentVerify,
  actor: FinanceActor,
): Promise<PaymentDetail> {
  assertStaff(actor)
  if (!actor.canVerify) throw smsForbidden()
  return applyPaymentVerification(id, {
    providerReference: input.providerReference,
    notes: input.notes,
    verifiedById: actor.userId,
  })
}

/**
 * Gateway-triggered verification (Phase 15). No staff actor exists for
 * webhook/callback verification; the caller (paystack service) is
 * responsible for authenticating the event BEFORE calling this.
 */
export async function verifyGatewayPayment(
  id: string,
  opts: { notes?: string | null; webhookPayload?: string | null } = {},
): Promise<PaymentDetail> {
  return applyPaymentVerification(id, {
    notes: opts.notes,
    webhookPayload: opts.webhookPayload,
    verifiedById: null,
  })
}

/**
 * Records a pending online-gateway payment (Phase 15). The payable
 * checks mirror recordPayment; the row becomes visible to parents only
 * after verification (parents never see pending payments).
 */
export async function createGatewayPendingPayment(input: {
  invoiceId: string
  amount: number
  providerReference: string
  idempotencyKey: string
  notes?: string | null
}): Promise<{ paymentId: string; paymentReference: string }> {
  const client = await db()
  const [invoice] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, input.invoiceId))
    .limit(1)
  if (!invoice) throw smsFieldError('invoiceId', 'Invoice not found.')
  if (!['issued', 'partially_paid'].includes(invoice.status)) {
    throw smsConflict(
      `Payments can only be recorded for issued or partially paid invoices (current: ${invoice.status}).`,
    )
  }
  if (input.amount > invoice.balance) {
    throw smsFieldError(
      'amount',
      `Amount exceeds the invoice balance of ${koboToNaira(invoice.balance)}.`,
    )
  }

  const paymentId = crypto.randomUUID()
  let paymentReference = ''
  await runDocNumberBatch(client, 'PAY', (reference) => {
    paymentReference = reference
    const paymentInsert = client.insert(payments)
    return [
      paymentInsert.values({
        id: paymentId,
        paymentReference: reference,
        invoiceId: input.invoiceId,
        studentId: invoice.studentId,
        amount: input.amount,
        method: 'online_gateway',
        status: 'pending',
        providerReference: input.providerReference,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes ?? null,
        paidAt: null,
      }),
    ]
  })
  return { paymentId, paymentReference }
}

export async function refundPayment(
  id: string,
  input: PaymentRefund,
  actor: FinanceActor,
): Promise<PaymentDetail> {
  assertStaff(actor)
  const client = await db()

  const [payment] = await client
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1)
  if (!payment) throw smsNotFound('Payment not found.')
  if (payment.status === 'refunded') {
    throw smsConflict('Payment is already refunded.')
  }
  if (payment.status !== 'verified') {
    throw smsConflict(
      `Only verified payments can be refunded (current: ${payment.status}).`,
    )
  }
  const [invoice] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, payment.invoiceId))
    .limit(1)
  if (!invoice) throw smsNotFound('Invoice not found.')

  const amountKobo = payment.amount
  const amountPaidKobo = invoice.amountPaid - amountKobo
  const newBalanceKobo = invoice.total - amountPaidKobo
  const nextStatus =
    invoice.status === 'void'
      ? 'void'
      : invoicePaymentStatus(newBalanceKobo, amountPaidKobo)

  const refundNote = input.notes?.trim()
  await client.batch([
    client
      .update(payments)
      .set({
        status: 'refunded',
        refundedAt: new Date().toISOString(),
        notes: refundNote
          ? `Refunded: ${refundNote}`
          : sql`coalesce(${payments.notes}, '') || 'Refunded.'`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payments.id, id)),
    client
      .update(studentInvoices)
      .set({
        amountPaid: Math.max(0, amountPaidKobo),
        balance: Math.max(0, newBalanceKobo),
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(studentInvoices.id, invoice.id)),
  ])
  return getPayment(id, actor)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function listOutstanding(
  query: OutstandingQuery,
  actor: FinanceActor,
): Promise<{ data: OutstandingRow[]; total: number }> {
  if (!actor.isStaff && !query.studentId) {
    throw smsForbidden()
  }
  const client = await db()
  const where: SQL[] = [
    inArray(studentInvoices.status, OUTSTANDING_STATUSES),
    sql`${studentInvoices.balance} > 0`,
  ]
  if (query.sessionId) {
    where.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) where.push(eq(studentInvoices.termId, query.termId))
  if (query.studentId) {
    if (!actor.isStaff && !actor.childIds.includes(query.studentId)) {
      throw smsForbidden()
    }
    where.push(eq(studentInvoices.studentId, query.studentId))
  } else if (!actor.isStaff) {
    where.push(inArray(studentInvoices.studentId, actor.childIds))
  }
  if (query.classId) {
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
  if (query.overdueOnly === 'true') {
    where.push(
      sql`${studentInvoices.dueDate} is not null and ${studentInvoices.dueDate} < current_date`,
    )
  }

  const filter = all(where)
  const countRows = await client
    .select({ n: sql<number>`cast(count(distinct ${studentInvoices.id}) as integer)` })
    .from(studentInvoices)
    .where(filter)
  const total = countRows[0]?.n ?? 0

  const rows = await invoiceJoinedQuery(client, filter)
  const seen = new Map<string, OutstandingRow>()
  for (const r of rows) {
    const mapped = mapInvoiceRow(r)
    if (!mapped.overdue && query.overdueOnly === 'true') continue
    if (!seen.has(mapped.id)) {
      seen.set(mapped.id, {
        id: mapped.id,
        invoiceNumber: mapped.invoiceNumber,
        studentId: mapped.studentId,
        studentName: mapped.studentName,
        admissionNumber: mapped.admissionNumber,
        className: mapped.className,
        sessionName: mapped.sessionName,
        termName: mapped.termName,
        issueDate: mapped.issueDate,
        dueDate: mapped.dueDate,
        total: mapped.total,
        amountPaid: mapped.amountPaid,
        balance: mapped.balance,
        status: mapped.status,
        overdue: mapped.overdue,
      })
    }
  }
  const items = [...seen.values()].sort((a, b) => {
    const da = a.dueDate ?? '9999-12-31'
    const db = b.dueDate ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return a.invoiceNumber < b.invoiceNumber ? -1 : 1
  })
  const offset = (query.page - 1) * query.perPage
  return { data: items.slice(offset, offset + query.perPage), total }
}

export async function financeSummary(
  query: FinanceSummaryQuery,
  actor: FinanceActor,
): Promise<FinanceSummary> {
  assertStaff(actor)
  const client = await db()

  const invoiceWhere: SQL[] = []
  if (query.sessionId) {
    invoiceWhere.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) invoiceWhere.push(eq(studentInvoices.termId, query.termId))
  invoiceWhere.push(inArray(studentInvoices.status, [
    'issued',
    'partially_paid',
    'paid',
  ]))

  const [totals] = await client
    .select({
      invoiced: sql<number>`cast(coalesce(sum(${studentInvoices.total}), 0) as integer)`,
      collected: sql<number>`cast(coalesce(sum(${studentInvoices.amountPaid}), 0) as integer)`,
      outstanding: sql<number>`cast(coalesce(sum(${studentInvoices.balance}), 0) as integer)`,
    })
    .from(studentInvoices)
    .where(all(invoiceWhere))

  const statusWhere: SQL[] = []
  if (query.sessionId) {
    statusWhere.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) {
    statusWhere.push(eq(studentInvoices.termId, query.termId))
  }
  const statusRows = await client
    .select({
      status: studentInvoices.status,
      n: sql<number>`cast(count(*) as integer)`,
    })
    .from(studentInvoices)
    .where(all(statusWhere))
    .groupBy(studentInvoices.status)

  const invoicesByStatus = {
    draft: 0,
    issued: 0,
    partially_paid: 0,
    paid: 0,
    overdue: 0,
    void: 0,
  } as Record<InvoiceStatus, number>
  for (const r of statusRows) {
    invoicesByStatus[r.status] = r.n
  }

  // Payments aggregate within scope via the parent invoice.
  const paymentWhere: SQL[] = [eq(payments.status, 'verified')]
  if (query.sessionId) {
    paymentWhere.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) paymentWhere.push(eq(studentInvoices.termId, query.termId))
  const methodRows = await client
    .select({
      method: payments.method,
      n: sql<number>`cast(count(*) as integer)`,
      total: sql<number>`cast(coalesce(sum(${payments.amount}), 0) as integer)`,
    })
    .from(payments)
    .innerJoin(studentInvoices, eq(payments.invoiceId, studentInvoices.id))
    .where(all(paymentWhere))
    .groupBy(payments.method)

  const methods: PaymentMethod[] = [
    'cash',
    'bank_transfer',
    'card',
    'online_gateway',
    'cheque',
    'other',
  ]
  const paymentsByMethod = methods.map((method) => {
    const row = methodRows.find((r) => r.method === method)
    return { method, count: row?.n ?? 0, total: row?.total ?? 0 }
  })

  const refundWhere: SQL[] = [eq(payments.status, 'refunded')]
  if (query.sessionId) {
    refundWhere.push(eq(studentInvoices.sessionId, query.sessionId))
  }
  if (query.termId) refundWhere.push(eq(studentInvoices.termId, query.termId))
  const [refunds] = await client
    .select({
      refunded: sql<number>`cast(coalesce(sum(${payments.amount}), 0) as integer)`,
    })
    .from(payments)
    .innerJoin(studentInvoices, eq(payments.invoiceId, studentInvoices.id))
    .where(all(refundWhere))

  return {
    sessionId: query.sessionId ?? null,
    termId: query.termId ?? null,
    totalInvoiced: totals?.invoiced ?? 0,
    totalCollected: totals?.collected ?? 0,
    totalRefunded: refunds?.refunded ?? 0,
    totalOutstanding: totals?.outstanding ?? 0,
    invoicesByStatus,
    paymentsByMethod,
  }
}
