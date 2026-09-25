/**
 * Paystack online-payment orchestration (Phase 15, README §41).
 *
 * Flow (hosted redirect):
 *   1. Parent/staff initializes → we create a PENDING payment
 *      (`method: online_gateway`, our PAY number, `providerReference` =
 *      generated VCS-* reference, `idempotencyKey` = paystack:{ref})
 *      and return Paystack's hosted checkout URL.
 *   2. Paystack redirects the browser to /payments/callback?reference=
 *      — the callback page calls the verify route, which re-verifies
 *      SERVER-SIDE with Paystack (the browser redirect alone never
 *      authorizes anything).
 *   3. Independently, Paystack POSTs a signed webhook. The signature
 *      (HMAC-SHA512 of the raw body) is verified, then the transaction
 *      is re-verified upstream before any accounting happens.
 *
 * Both paths share decideVerification() + verifyGatewayPayment(), so a
 * payment is verified exactly once regardless of arrival order; replays
 * and duplicates are no-ops.
 *
 * The service degrades gracefully: with no PAYSTACK_SECRET_KEY every
 * entry point fails closed and the UI hides online checkout.
 */
import { getRequestURL, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { payments, studentInvoices, users } from '../../database/schema'
import type { SmsDb } from '../utils/pagination'
import {
  smsConflict,
  smsFieldError,
  smsForbidden,
  smsNotFound,
} from '../utils/http-errors'
import {
  initializeTransaction,
  verifyTransaction,
} from '../utils/paystack/client'
import { verifyPaystackSignature } from '../utils/paystack/signature'
import { generatePaystackReference } from '../utils/paystack/reference'
import { decideVerification } from '../utils/paystack/decision'
import {
  createGatewayPendingPayment,
  getPayment,
  verifyGatewayPayment,
  type FinanceActor,
} from './finance'
import type {
  PaymentDetail,
  PaystackInitializeResult,
  PaystackVerifyResult,
} from '../../shared/types'
import type { PaystackInitialize } from '../../shared/schemas'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

function getSecretKey(event: H3Event): string {
  const secret = useRuntimeConfig(event).paystackSecretKey
  if (!secret) {
    throw smsConflict('Online payment is not configured.')
  }
  return secret
}

export function isPaystackConfigured(event: H3Event): boolean {
  return Boolean(useRuntimeConfig(event).paystackSecretKey)
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

export async function initializeOnlinePayment(
  event: H3Event,
  input: PaystackInitialize,
  actor: FinanceActor,
): Promise<PaystackInitializeResult> {
  const secret = getSecretKey(event)
  const client = await db()

  const [invoice] = await client
    .select()
    .from(studentInvoices)
    .where(eq(studentInvoices.id, input.invoiceId))
    .limit(1)
  if (!invoice) throw smsFieldError('invoiceId', 'Invoice not found.')
  // Parents may only pay their own children's invoices (staff may assist).
  if (!actor.isStaff && !actor.childIds.includes(invoice.studentId)) {
    throw smsNotFound('Invoice not found.')
  }
  if (!['issued', 'partially_paid'].includes(invoice.status)) {
    throw smsConflict(
      `This invoice is not payable online (status: ${invoice.status}).`,
    )
  }

  // Paystack requires the payer email.
  const [payer] = await client
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1)
  if (!payer?.email) {
    throw smsConflict(
      'Your account has no email address for online checkout.',
    )
  }

  const reference = generatePaystackReference(invoice.invoiceNumber)
  const origin = getRequestURL(event).origin
  const tx = await initializeTransaction(secret, {
    email: payer.email,
    amount: input.amount,
    reference,
    callbackUrl: `${origin}/payments/callback`,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
    },
  })

  // Persist only AFTER the gateway accepted the transaction; an unused
  // gateway transaction is harmless, an untracked pending payment is not.
  await createGatewayPendingPayment({
    invoiceId: invoice.id,
    amount: input.amount,
    providerReference: reference,
    idempotencyKey: `paystack:${reference}`,
  })

  return { authorizationUrl: tx.authorization_url, reference }
}

// ---------------------------------------------------------------------------
// Shared lookup + scoped verification
// ---------------------------------------------------------------------------

async function findByProviderReference(
  client: SmsDb,
  reference: string,
): Promise<typeof payments.$inferSelect | null> {
  const [row] = await client
    .select()
    .from(payments)
    .where(eq(payments.providerReference, reference))
    .limit(1)
  return row ?? null
}

function assertPaymentVisible(
  payment: typeof payments.$inferSelect,
  actor: FinanceActor,
): void {
  if (!actor.isStaff && !actor.childIds.includes(payment.studentId)) {
    // Not-found rather than forbidden: never confirm a reference exists.
    throw smsNotFound('Payment not found.')
  }
}

interface VerifyOutcome {
  payment: PaymentDetail
  /** True when THIS call transitioned the payment to verified. */
  transitioned: boolean
  gatewayStatus: string | null
}

async function verifyAgainstGateway(
  event: H3Event,
  payment: typeof payments.$inferSelect,
  opts: { webhookPayload?: string; auditNote: string },
): Promise<VerifyOutcome> {
  const decision = decideVerification(
    { status: payment.status, amount: payment.amount },
    null,
  )
  if (decision === 'already-verified') {
    return {
      payment: await getPayment(payment.id, {
        userId: '',
        isAdmin: true,
        isStaff: true,
        canVerify: true,
        parentId: null,
        childIds: [],
      }),
      transitioned: false,
      gatewayStatus: null,
    }
  }
  if (decision === 'not-pending') {
    throw smsConflict(
      `Payment cannot be verified (status: ${payment.status}).`,
    )
  }

  // Server-side re-verification — neither the browser callback nor the
  // webhook body alone is trusted.
  const tx = await verifyTransaction(
    getSecretKey(event),
    payment.providerReference!,
  )
  const verdict = decideVerification(
    { status: payment.status, amount: payment.amount },
    { status: tx.status, amount: tx.amount, currency: tx.currency },
  )
  if (verdict === 'amount-mismatch' || verdict === 'currency-mismatch') {
    // Record the payload for investigation; never auto-verify.
    if (opts.webhookPayload) {
      const client = await db()
      await client
        .update(payments)
        .set({
          webhookPayload: opts.webhookPayload,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(payments.id, payment.id))
    }
    throw smsConflict(
      'Gateway transaction does not match the recorded payment; the office has been notified.',
    )
  }
  if (verdict !== 'verify') {
    return {
      payment: await getPayment(payment.id, {
        userId: '',
        isAdmin: true,
        isStaff: true,
        canVerify: true,
        parentId: null,
        childIds: [],
      }),
      transitioned: false,
      gatewayStatus: tx.status,
    }
  }

  const verified = await verifyGatewayPayment(payment.id, {
    notes: opts.auditNote,
    webhookPayload: opts.webhookPayload ?? null,
  })
  return { payment: verified, transitioned: true, gatewayStatus: tx.status }
}

/** Browser-callback verify (authenticated parent/staff). */
export async function verifyOnlinePayment(
  event: H3Event,
  reference: string,
  actor: FinanceActor,
): Promise<PaystackVerifyResult> {
  const client = await db()
  const payment = await findByProviderReference(client, reference)
  if (!payment) throw smsNotFound('Payment not found.')
  assertPaymentVisible(payment, actor)

  const outcome = await verifyAgainstGateway(event, payment, {
    auditNote: 'Verified via Paystack callback.',
  })
  return {
    verified: outcome.payment.status === 'verified',
    alreadyVerified: outcome.payment.status === 'verified' && !outcome.transitioned,
    gatewayStatus: outcome.gatewayStatus,
    payment: outcome.payment,
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

interface PaystackWebhookEvent {
  event?: string
  data?: { reference?: string }
}

/**
 * Handles a signed Paystack webhook POST. Returns a small ack object;
 * unknown events/references and replays are acknowledged with 200 so
 * Paystack stops retrying, while bad signatures get 401.
 */
export async function handlePaystackWebhook(
  event: H3Event,
  rawBody: string,
  signature: string | null,
): Promise<{ received: true }> {
  const secret = getSecretKey(event)
  if (!(await verifyPaystackSignature(secret, rawBody, signature))) {
    throw smsForbidden('Invalid webhook signature.')
  }

  let payload: PaystackWebhookEvent
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookEvent
  } catch {
    return { received: true }
  }
  if (payload.event !== 'charge.success' || !payload.data?.reference) {
    return { received: true }
  }

  const client = await db()
  const payment = await findByProviderReference(client, payload.data.reference)
  if (!payment || payment.status === 'verified') {
    // Unknown reference (not ours) or replay — acknowledge, no-op.
    return { received: true }
  }
  if (payment.status !== 'pending') {
    return { received: true }
  }

  try {
    await verifyAgainstGateway(event, payment, {
      webhookPayload: rawBody,
      auditNote: 'Verified via Paystack webhook.',
    })
  } catch (error) {
    // Signature was valid and the reference is ours — swallow conflicts
    // (e.g. concurrent callback verify won the race) so Paystack stops
    // retrying; anything else also acks to avoid poison-message loops.
    console.error('[paystack] webhook verification failed:', error)
  }
  return { received: true }
}
