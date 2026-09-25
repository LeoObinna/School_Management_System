/**
 * POST /api/v1/payments/paystack/verify
 *
 * Browser callback verify — the parent is redirected here after
 * Paystack checkout (they also call this via the callback page).
 * Re-verifies the transaction with Paystack server-side before any
 * accounting; idempotent with the webhook path.
 */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { paystackVerifySchema } from '~/shared/schemas'
import { getFinanceActor } from '~/server/services/finance'
import { verifyOnlinePayment } from '~/server/services/paystack'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.view')
  const data = parseBody(paystackVerifySchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const result = await verifyOnlinePayment(event, data.reference, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: result.verified
      ? 'payment.verify'
      : 'payment.verify-attempt',
    resource: 'payment',
    resourceId: result.payment.id,
    metadata: { reference: data.reference, alreadyVerified: result.alreadyVerified },
    description: result.verified
      ? `Verified Paystack payment ${data.reference}.`
      : `Paystack verify attempt for ${data.reference} (status: ${result.gatewayStatus ?? 'unknown'}).`,
  })
  return result
})
