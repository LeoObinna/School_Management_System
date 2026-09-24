/** DELETE /api/v1/inventory/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  deleteInventoryItem,
  getInventoryItem,
} from '~/server/services/inventory'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'inventory.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const existing = await getInventoryItem(id)
  await deleteInventoryItem(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'inventory.delete',
    resource: 'inventory_item',
    resourceId: id,
    description: `Deleted inventory item "${existing.name}".`,
  })
  return { ok: true }
})
