/** DELETE /api/v1/fee-structures/{id}/items/{itemId} */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { deleteFeeItem } from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({
  id: uuidSchema,
  itemId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.manage_structure')
  const { id, itemId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    itemId: getRouterParam(event, 'itemId'),
  })
  const result = await deleteFeeItem(id, itemId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'fee_structure.item_delete',
    resource: 'fee_item',
    resourceId: itemId,
    description: 'Removed fee item.',
  })
  return result
})
