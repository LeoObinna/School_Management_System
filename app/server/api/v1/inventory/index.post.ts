/** POST /api/v1/inventory */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { inventoryItemCreateSchema } from '~/shared/schemas'
import { createInventoryItem } from '~/server/services/inventory'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'inventory.manage')
  const data = parseBody(inventoryItemCreateSchema, await readBody(event))
  const item = await createInventoryItem(data, auth.user.id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'inventory.create',
    resource: 'inventory_item',
    resourceId: item.id,
    description: `Created inventory item "${item.name}" (${item.itemType}, qty ${item.quantity}).`,
  })
  setResponseStatus(event, 201)
  return item
})
