/** POST /api/v1/payments/{id}/refund */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  idParamSchema,
  paymentRefundSchema,
} from '~/shared/schemas'
import {
  getFinanceActor,
  refundPayment,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.refund')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(paymentRefundSchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const payment = await refundPayment(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'payment.refund',
    resource: 'payment',
    resourceId: payment.id,
    description: `Refunded ${payment.amount} (${payment.paymentReference}).`,
  })
  return payment
})
