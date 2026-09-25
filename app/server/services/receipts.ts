/**
 * Receipt PDF service (Phase 15).
 *
 * Builds the render data from the existing actor-scoped finance reads
 * (parent/child visibility rules are enforced there), renders the
 * branded PDF lazily, stores it in R2 and persists the object key on
 * the receipt row. Regeneration overwrites the same deterministic key.
 */
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { paymentReceipts } from '../../database/schema'
import type { SmsDb } from '../utils/pagination'
import { putObject } from '../utils/storage'
import {
  getInvoice,
  getPayment,
  getPaymentReceipt,
  type FinanceActor,
} from './finance'
import { getSchoolSettings } from './school-settings'
import {
  buildReceiptObjectKey,
  renderReceiptPdf,
  type ReceiptData,
} from '../utils/pdf/receipt'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

/** Actor-scoped: throws 404 unless the caller may view this receipt. */
export async function getReceiptPdfData(
  paymentId: string,
  actor: FinanceActor,
): Promise<{ data: ReceiptData; receiptId: string; objectKey: string | null }> {
  const [receipt, payment] = await Promise.all([
    getPaymentReceipt(paymentId, actor),
    getPayment(paymentId, actor),
  ])
  const invoice = await getInvoice(payment.invoiceId, actor)

  const data: ReceiptData = {
    receiptNumber: receipt.receiptNumber,
    issuedAt: receipt.issuedAt,
    paymentReference: payment.paymentReference,
    providerReference: payment.providerReference,
    method: payment.method,
    amount: payment.amount,
    paidAt: payment.paidAt,
    studentName: payment.studentName,
    admissionNumber: payment.admissionNumber || null,
    className: invoice.className,
    invoiceNumber: invoice.invoiceNumber,
    sessionName: invoice.sessionName,
    termName: invoice.termName,
    items: invoice.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitAmount: i.unitAmount,
      lineTotal: i.lineTotal,
    })),
    invoiceTotal: invoice.total,
    invoiceAmountPaid: invoice.amountPaid,
    invoiceBalance: invoice.balance,
  }
  return { data, receiptId: receipt.id, objectKey: receipt.objectKey }
}

/**
 * Returns the R2 object key for the receipt PDF, generating + storing
 * it on first request. Requires the R2 binding (503 in plain Node dev).
 */
export async function ensureReceiptPdf(
  event: H3Event,
  paymentId: string,
  actor: FinanceActor,
): Promise<{ objectKey: string; receiptNumber: string }> {
  const { data, receiptId, objectKey } = await getReceiptPdfData(
    paymentId,
    actor,
  )
  if (objectKey) {
    return { objectKey, receiptNumber: data.receiptNumber }
  }

  const key = buildReceiptObjectKey(data.receiptNumber)
  const settings = await getSchoolSettings(event)
  const bytes = await renderReceiptPdf(data, settings)
  await putObject(event, key, bytes, 'application/pdf')

  const client = await db()
  await client
    .update(paymentReceipts)
    .set({ objectKey: key })
    .where(eq(paymentReceipts.id, receiptId))

  return { objectKey: key, receiptNumber: data.receiptNumber }
}
