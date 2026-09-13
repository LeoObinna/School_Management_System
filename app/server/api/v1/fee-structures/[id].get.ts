/** GET /api/v1/fee-structures/{id} */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getFeeStructure, getFinanceActor } from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  return getFeeStructure(id, actor)
})
