/** POST /api/v1/payments/{id}/verify */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  idParamSchema,
  paymentVerifySchema,
} from '~/shared/schemas'
import {
  getFinanceActor,
  verifyPayment,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.verify')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(paymentVerifySchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const payment = await verifyPayment(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'payment.verify',
    resource: 'payment',
    resourceId: payment.id,
    description: `Verified ${payment.amount} (${payment.paymentReference}).`,
  })
  if (payment.receipt) {
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'receipt.generate',
      resource: 'payment_receipt',
      resourceId: payment.receipt.id,
      description: `Generated receipt ${payment.receipt.receiptNumber}.`,
    })
  }
  return payment
})
