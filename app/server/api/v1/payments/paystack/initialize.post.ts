/**
 * POST /api/v1/payments/paystack/initialize
 *
 * Parent/staff initiates an online checkout for an invoice.
 * Returns a Paystack-hosted checkout URL; the browser is expected to
 * redirect there.
 */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { paystackInitializeSchema } from '~/shared/schemas'
import { getFinanceActor } from '~/server/services/finance'
import {
  initializeOnlinePayment,
} from '~/server/services/paystack'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.view')
  const data = parseBody(paystackInitializeSchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const result = await initializeOnlinePayment(event, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'payment.initialize',
    resource: 'payment',
    resourceId: null,
    metadata: { reference: result.reference, amount: data.amount },
    description: `Initialized Paystack checkout ${result.reference}.`,
  })
  return result
})
