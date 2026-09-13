/** GET /api/v1/payments/{id}/receipt */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getFinanceActor,
  getPaymentReceipt,
} from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'receipts.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  return getPaymentReceipt(id, actor)
})
