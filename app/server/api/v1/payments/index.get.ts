/** GET /api/v1/payments */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { paymentListQuerySchema } from '~/shared/schemas'
import { getFinanceActor, listPayments } from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.view')
  const query = parseQueryData(paymentListQuerySchema, getQuery(event))
  const actor = await getFinanceActor(auth)
  return listPayments(query, actor)
})
