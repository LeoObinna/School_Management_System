/**
 * Pure verification-decision logic for gateway payments (Phase 15).
 *
 * Both the browser-callback verify route and the signed webhook funnel
 * into the same rules, kept pure here so they are unit-testable without
 * D1 or network:
 *
 * - already-verified payments are a no-op (idempotent replays);
 * - non-pending payments can never transition;
 * - the gateway transaction must be `success`;
 * - amount (kobo) and currency must match EXACTLY what we recorded —
 *   a browser callback or webhook alone never authorizes money.
 */
export interface GatewayPaymentSnapshot {
  status: string
  /** Recorded amount in kobo. */
  amount: number
}

export interface GatewayTransactionSnapshot {
  status: string
  /** Gateway-reported amount in kobo. */
  amount: number
  currency: string
}

export type VerificationDecision =
  | 'verify'
  | 'already-verified'
  | 'not-pending'
  | 'not-successful'
  | 'amount-mismatch'
  | 'currency-mismatch'

export function decideVerification(
  payment: GatewayPaymentSnapshot,
  tx: GatewayTransactionSnapshot | null,
  expectedCurrency = 'NGN',
): VerificationDecision {
  if (payment.status === 'verified') return 'already-verified'
  if (payment.status !== 'pending') return 'not-pending'
  if (!tx || tx.status !== 'success') return 'not-successful'
  if (tx.amount !== payment.amount) return 'amount-mismatch'
  if (tx.currency !== expectedCurrency) return 'currency-mismatch'
  return 'verify'
}
