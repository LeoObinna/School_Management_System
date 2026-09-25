/**
 * Paystack transaction references (Phase 15).
 *
 * We generate the reference ourselves (instead of letting Paystack
 * assign one) so it is self-describing and traceable to an invoice:
 *   VCS-{invoiceNumber}-{10 hex chars}
 * e.g. VCS-INV-2026-0001-4f2a9c1e7b
 *
 * The reference is stored on `payments.provider_reference` and echoed
 * back by Paystack webhooks/verify, which is how gateway events are
 * matched to our records.
 */
export const PAYSTACK_REFERENCE_PREFIX = 'VCS-'

const REFERENCE_MAX = 100 // Paystack reference limit

export function generatePaystackReference(invoiceNumber: string): string {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
  const reference = `${PAYSTACK_REFERENCE_PREFIX}${invoiceNumber}-${suffix}`
  // Invoice numbers are short (INV-YYYY-NNNN); guard anyway.
  return reference.slice(0, REFERENCE_MAX)
}

export function isPaystackReference(value: string): boolean {
  return value.startsWith(PAYSTACK_REFERENCE_PREFIX)
}
