/** POST /api/v1/payments */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { paymentCreateSchema } from '~/shared/schemas'
import {
  getFinanceActor,
  recordPayment,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.record')
  const data = parseBody(paymentCreateSchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const payment = await recordPayment(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: payment.status === 'verified' ? 'payment.verify' : 'payment.record',
    resource: 'payment',
    resourceId: payment.id,
    description:
      payment.status === 'verified'
        ? `Recorded and verified ${payment.amount} (${payment.paymentReference}).`
        : `Recorded pending ${payment.amount} (${payment.paymentReference}).`,
  })
  if (payment.status === 'verified' && payment.receipt) {
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'receipt.generate',
      resource: 'payment_receipt',
      resourceId: payment.receipt.id,
      description: `Generated receipt ${payment.receipt.receiptNumber}.`,
    })
  }
  setResponseStatus(event, 201)
  return payment
})
