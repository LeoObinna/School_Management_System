/**
 * Finance tables (README §19).
 *
 * Fee Structure -> Fee Items -> Invoice -> Invoice Items -> Payment
 * -> Verification -> Receipt.
 *
 * ALL monetary columns use NUMERIC(p,s) — never float/real — to ensure
 * exact financial arithmetic. Payment provider references and an
 * idempotency key support verified webhooks; browser-reported payment
 * success is never trusted.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  date,
  numeric,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { students } from './people'
import { users } from './core'
import { academicSessions, terms, classes } from './academics'
import {
  invoiceStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
} from './enums'

const MONEY = { precision: 12, scale: 2 }

// ---------------------------------------------------------------------------
// Fee structures (templates for a session / class)
// ---------------------------------------------------------------------------
export const feeStructures = pgTable(
  'fee_structures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    classId: uuid('class_id').references(() => classes.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: index('fee_structures_session_idx').on(t.sessionId),
  }),
)

// ---------------------------------------------------------------------------
// Fee items (line definitions within a structure)
// ---------------------------------------------------------------------------
export const feeItems = pgTable('fee_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  feeStructureId: uuid('fee_structure_id')
    .notNull()
    .references(() => feeStructures.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  amount: numeric('amount', MONEY).notNull(),
  isOptional: boolean('is_optional').default(false).notNull(),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Student invoices
// ---------------------------------------------------------------------------
export const studentInvoices = pgTable(
  'student_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: uuid('term_id').references(() => terms.id, {
      onDelete: 'set null',
    }),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date'),
    subtotal: numeric('subtotal', MONEY).default('0').notNull(),
    discount: numeric('discount', MONEY).default('0').notNull(),
    tax: numeric('tax', MONEY).default('0').notNull(),
    total: numeric('total', MONEY).default('0').notNull(),
    amountPaid: numeric('amount_paid', MONEY).default('0').notNull(),
    balance: numeric('balance', MONEY).default('0').notNull(),
    status: invoiceStatusEnum('status').default('draft').notNull(),
    notes: text('notes'),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => studentInvoices.id, { onDelete: 'cascade' }),
  feeItemId: uuid('fee_item_id').references(() => feeItems.id, {
    onDelete: 'set null',
  }),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  unitAmount: numeric('unit_amount', MONEY).notNull(),
  lineTotal: numeric('line_total', MONEY).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentReference: varchar('payment_reference', { length: 100 }).notNull(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => studentInvoices.id, { onDelete: 'restrict' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    amount: numeric('amount', MONEY).notNull(),
    method: paymentMethodEnum('method').default('cash').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    providerReference: varchar('provider_reference', { length: 255 }),
    // Idempotency key from the payment gateway webhook.
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    webhookPayload: text('webhook_payload'), // stored for audit/verification
    paidAt: timestamp('paid_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedById: uuid('verified_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    receiptNumber: varchar('receipt_number', { length: 100 }).notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    objectKey: text('object_key'), // PDF stored in R2
    issuedById: uuid('issued_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    receiptNoIdx: uniqueIndex('payment_receipts_no_idx').on(t.receiptNumber),
    paymentIdx: index('payment_receipts_payment_idx').on(t.paymentId),
  }),
)
