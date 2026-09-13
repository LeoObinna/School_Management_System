/** GET /api/v1/payments/{id} */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getFinanceActor,
  getPayment,
} from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  return getPayment(id, actor)
})
