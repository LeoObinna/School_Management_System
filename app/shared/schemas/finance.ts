/**
 * Finance validation schemas (README §19, D1 Phase 4b).
 *
 * Money is INTEGER kobo (₦1 = 100 kobo) on D1/SQLite. Schemas
 * validate the integer kobo transport shape; no string parsing
 * happens server-side (the UI converts naira input → kobo before
 * posting via `parseNairaToKobo`).
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  dateStringSchema,
  koboSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
] as const

export const PAYMENT_STATUSES = [
  'pending',
  'verified',
  'failed',
  'refunded',
] as const

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'card',
  'online_gateway',
  'cheque',
  'other',
] as const

// Non-negative / positive integer kobo (₦1 = 100 kobo). Capped at
// ₦99,999,999.99 (9,999,999,999 kobo) — well beyond any school fee.
const nonNegativeKoboSchema = koboSchema.max(9_999_999_999)
const positiveKoboSchema = koboSchema.min(1).max(9_999_999_999)

// ---------------------------------------------------------------------------
// Fee structures + items
// ---------------------------------------------------------------------------
export const feeItemInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  amount: positiveKoboSchema,
  isOptional: z.boolean().optional(),
  dueDate: dateStringSchema.nullable().optional(),
})
export type FeeItemInput = z.infer<typeof feeItemInputSchema>

const feeStructureBaseSchema = z.object({
  sessionId: uuidSchema,
  classId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  items: z.array(feeItemInputSchema).min(1).max(100),
})

export const feeStructureCreateSchema = feeStructureBaseSchema
export type FeeStructureCreate = z.infer<typeof feeStructureCreateSchema>

export const feeStructureUpdateSchema = feeStructureBaseSchema
  .partial()
  .extend({
    items: z.array(feeItemInputSchema).min(1).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type FeeStructureUpdate = z.infer<typeof feeStructureUpdateSchema>

export const feeStructureListQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  isActive: booleanParamSchema,
})
export type FeeStructureListQuery = z.infer<
  typeof feeStructureListQuerySchema
>

// Standalone item upsert for POST /fee-structures/:id/items.
export const feeItemUpsertSchema = feeItemInputSchema
export type FeeItemUpsert = z.infer<typeof feeItemUpsertSchema>

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export const manualInvoiceItemSchema = z.object({
  feeItemId: uuidSchema.optional(),
  description: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().int().min(1).max(9999).optional(),
  unitAmount: positiveKoboSchema,
})
export type ManualInvoiceItem = z.infer<typeof manualInvoiceItemSchema>

export const invoiceCreateSchema = z
  .object({
    studentId: uuidSchema,
    sessionId: uuidSchema,
    termId: uuidSchema.nullable().optional(),
    issueDate: dateStringSchema,
    dueDate: dateStringSchema.nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    discount: nonNegativeKoboSchema.optional(),
    tax: nonNegativeKoboSchema.optional(),
    // Materialize from a fee structure (optional items selection;
    // optional fee items are excluded unless explicitly selected).
    feeStructureId: uuidSchema.optional(),
    feeItemIds: z.array(uuidSchema).max(100).optional(),
    // Or fully manual line items.
    items: z.array(manualInvoiceItemSchema).min(1).max(100).optional(),
  })
  .refine((d) => Boolean(d.feeStructureId) || (d.items && d.items.length), {
    message: 'Provide either feeStructureId or at least one item.',
    path: ['items'],
  })
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>

// Draft invoices may be edited before issuing.
export const invoiceUpdateSchema = z
  .object({
    termId: uuidSchema.nullable().optional(),
    issueDate: dateStringSchema.optional(),
    dueDate: dateStringSchema.nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    discount: nonNegativeKoboSchema.optional(),
    tax: nonNegativeKoboSchema.optional(),
    items: z.array(manualInvoiceItemSchema).min(1).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type InvoiceUpdate = z.infer<typeof invoiceUpdateSchema>

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  studentId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
})
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const paymentCreateSchema = z.object({
  invoiceId: uuidSchema,
  amount: positiveKoboSchema,
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(2000).nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  providerReference: z.string().trim().max(255).nullable().optional(),
  // Staff with payments.verify may record-and-verify cash in one step.
  verifyImmediately: z.boolean().optional(),
})
export type PaymentCreate = z.infer<typeof paymentCreateSchema>

export const paymentVerifySchema = z.object({
  providerReference: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})
export type PaymentVerify = z.infer<typeof paymentVerifySchema>

export const paymentRefundSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
})
export type PaymentRefund = z.infer<typeof paymentRefundSchema>

// ---------------------------------------------------------------------------
// Paystack online checkout (Phase 15)
// ---------------------------------------------------------------------------
// Paystack's platform minimum charge is ₦50 (5,000 kobo).
export const paystackInitializeSchema = z.object({
  invoiceId: uuidSchema,
  amount: positiveKoboSchema.min(
    5_000,
    'The minimum online payment is ₦50.',
  ),
})
export type PaystackInitialize = z.infer<typeof paystackInitializeSchema>

export const paystackVerifySchema = z.object({
  reference: z.string().trim().min(8).max(100),
})
export type PaystackVerify = z.infer<typeof paystackVerifySchema>

export const paymentListQuerySchema = paginationQuerySchema.extend({
  invoiceId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
})
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>

// ---------------------------------------------------------------------------
// Finance reports
// ---------------------------------------------------------------------------
export const outstandingQuerySchema = paginationQuerySchema.extend({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  overdueOnly: z.enum(['true', 'false']).optional(),
})
export type OutstandingQuery = z.infer<typeof outstandingQuerySchema>

export const financeSummaryQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
})
export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>
