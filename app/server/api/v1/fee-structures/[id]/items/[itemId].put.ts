/** PUT /api/v1/fee-structures/{id}/items/{itemId} */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { feeItemUpsertSchema, uuidSchema } from '~/shared/schemas'
import { updateFeeItem } from '~/server/services/finance'
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
  const data = parseBody(feeItemUpsertSchema, await readBody(event))
  const structure = await updateFeeItem(id, itemId, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'fee_structure.item_update',
    resource: 'fee_item',
    resourceId: itemId,
    description: `Updated fee item "${data.name}".`,
  })
  return structure
})
