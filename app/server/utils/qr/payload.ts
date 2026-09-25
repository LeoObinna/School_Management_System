/**
 * QR payload builders (Phase 15).
 *
 * Plain-text, human-verifiable payloads — no proprietary bank QR
 * standard is assumed. Office/invoice payloads carry the school's bank
 * details (from settings) so a parent can scan-and-check before making
 * a transfer; the receipt payload carries the receipt/payment references
 * and amount for authenticity verification.
 *
 * All builders are pure; money renders ASCII-safe (`NGN 150,000.00`).
 */
import type { SchoolSettings } from '../../../shared/types'
import { formatReceiptMoney } from '../pdf/receipt'

function bankLines(settings: SchoolSettings): string[] | null {
  if (!settings.bankName || !settings.accountNumber) return null
  return [
    `Bank: ${settings.bankName}`,
    `Account name: ${settings.accountName || settings.name}`,
    `Account number: ${settings.accountNumber}`,
  ]
}

/** Office QR: school bank details only. Null when not configured. */
export function buildOfficeQrPayload(settings: SchoolSettings): string | null {
  const bank = bankLines(settings)
  if (!bank) return null
  return [`${settings.name} — school fee payment`, ...bank].join('\n')
}

/**
 * Invoice QR: bank details + invoice reference + amount due (current
 * balance in kobo). Null when bank details are not configured.
 */
export function buildInvoiceQrPayload(
  settings: SchoolSettings,
  invoice: { invoiceNumber: string; balance: number },
): string | null {
  const bank = bankLines(settings)
  if (!bank) return null
  return [
    `${settings.name} — school fee payment`,
    ...bank,
    `Reference: ${invoice.invoiceNumber}`,
    `Amount due: ${formatReceiptMoney(invoice.balance)}`,
  ].join('\n')
}

/** Receipt QR: embedded in the receipt PDF for authenticity checks. */
export function buildReceiptQrPayload(data: {
  receiptNumber: string
  paymentReference: string
  amount: number
}): string {
  return [
    `Receipt ${data.receiptNumber}`,
    `Payment ${data.paymentReference}`,
    `Amount ${formatReceiptMoney(data.amount)}`,
  ].join('\n')
}
