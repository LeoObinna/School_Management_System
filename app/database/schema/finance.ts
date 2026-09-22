/**
 * Finance tables (README §19).
 *
 * Fee Structure -> Fee Items -> Invoice -> Invoice Items -> Payment
 * -> Verification -> Receipt.
 *
 * ALL monetary columns use INTEGER kobo (₦150,000.00 → 15,000,000)
 * per the v2.0 spec — never float/real — to ensure exact financial
 * arithmetic. Payment provider references and an idempotency key
 * support verified webhooks; browser-reported payment success is
 * never trusted.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `numeric` money → `integer` kobo, `uuid` → `text` IDs,
 * `timestamp` → text ISO-8601, `date` → text YYYY-MM-DD,
 * `boolean` → integer 0/1, `integer` quantity stays integer.
 * Phase 3 adapts the service layer to read/write kobo values.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { students } from './people'
import { users } from './core'
import { academicSessions, terms, classes } from './academics'
import {
  invoiceStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
} from './enums'

// ---------------------------------------------------------------------------
// Fee structures (templates for a session / class)
// ---------------------------------------------------------------------------
export const feeStructures = sqliteTable(
  'fee_structures',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    classId: text('class_id').references(() => classes.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    sessionIdx: index('fee_structures_session_idx').on(t.sessionId),
  }),
)

// ---------------------------------------------------------------------------
// Fee items (line definitions within a structure)
// ---------------------------------------------------------------------------
export const feeItems = sqliteTable('fee_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  feeStructureId: text('fee_structure_id')
    .notNull()
    .references(() => feeStructures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // Amount in kobo (₦150,000.00 → 15,000,000).
  amount: integer('amount').notNull(),
  isOptional: integer('is_optional', { mode: 'boolean' })
    .default(false)
    .notNull(),
  dueDate: text('due_date'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ---------------------------------------------------------------------------
// Student invoices
// ---------------------------------------------------------------------------
export const studentInvoices = sqliteTable(
  'student_invoices',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    invoiceNumber: text('invoice_number').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date'),
    // All monetary fields in kobo (₦0.00 → 0).
    subtotal: integer('subtotal').default(0).notNull(),
    discount: integer('discount').default(0).notNull(),
    tax: integer('tax').default(0).notNull(),
    total: integer('total').default(0).notNull(),
    amountPaid: integer('amount_paid').default(0).notNull(),
    balance: integer('balance').default(0).notNull(),
    status: invoiceStatusEnum('status').default('draft').notNull(),
    notes: text('notes'),
    createdById: text('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    invoiceNoIdx: uniqueIndex('student_invoices_no_idx').on(t.invoiceNumber),
    studentIdx: index('student_invoices_student_idx').on(
      t.studentId,
      t.sessionId,
      t.termId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Invoice items
// ---------------------------------------------------------------------------
export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => studentInvoices.id, { onDelete: 'cascade' }),
  feeItemId: text('fee_item_id').references(() => feeItems.id, {
    onDelete: 'set null',
  }),
  description: text('description').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  // All monetary fields in kobo.
  unitAmount: integer('unit_amount').notNull(),
  lineTotal: integer('line_total').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const payments = sqliteTable(
  'payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    paymentReference: text('payment_reference').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => studentInvoices.id, { onDelete: 'restrict' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    // Amount in kobo.
    amount: integer('amount').notNull(),
    method: paymentMethodEnum('method').default('cash').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    providerReference: text('provider_reference'),
    // Idempotency key from the payment gateway webhook.
    idempotencyKey: text('idempotency_key'),
    webhookPayload: text('webhook_payload'), // stored for audit/verification
    paidAt: text('paid_at'),
    verifiedAt: text('verified_at'),
    verifiedById: text('verified_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    refundedAt: text('refunded_at'),
    notes: text('notes'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    paymentRefIdx: uniqueIndex('payments_reference_idx').on(
      t.paymentReference,
    ),
    idempotencyIdx: uniqueIndex('payments_idempotency_idx').on(
      t.idempotencyKey,
    ),
    invoiceIdx: index('payments_invoice_idx').on(t.invoiceId),
    studentIdx: index('payments_student_idx').on(t.studentId),
  }),
)

// ---------------------------------------------------------------------------
// Payment receipts
// ---------------------------------------------------------------------------
export const paymentReceipts = sqliteTable(
  'payment_receipts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    receiptNumber: text('receipt_number').notNull(),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    objectKey: text('object_key'), // PDF stored in R2
    issuedById: text('issued_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    issuedAt: text('issued_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    receiptNoIdx: uniqueIndex('payment_receipts_no_idx').on(t.receiptNumber),
    paymentIdx: index('payment_receipts_payment_idx').on(t.paymentId),
  }),
)
