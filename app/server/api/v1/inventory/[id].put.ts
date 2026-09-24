/** PUT /api/v1/inventory/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  inventoryItemUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateInventoryItem } from '~/server/services/inventory'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'inventory.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(inventoryItemUpdateSchema, await readBody(event))
  const item = await updateInventoryItem(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'inventory.update',
    resource: 'inventory_item',
    resourceId: id,
    description: `Updated inventory item "${item.name}".`,
  })
  return item
})
