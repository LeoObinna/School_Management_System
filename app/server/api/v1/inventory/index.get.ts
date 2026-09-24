/** GET /api/v1/inventory */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { inventoryListQuerySchema } from '~/shared/schemas'
import { listInventoryItems } from '~/server/services/inventory'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'inventory.view')
  const query = parseQueryData(inventoryListQuerySchema, getQuery(event))
  return listInventoryItems(query)
})
