/** GET /api/v1/inventory/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getInventoryItem } from '~/server/services/inventory'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'inventory.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getInventoryItem(id)
})
