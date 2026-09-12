/** GET /api/v1/parents */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { parentListQuerySchema } from '~/shared/schemas'
import { listParents } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'parents.view')
  const query = parseQueryData(parentListQuerySchema, getQuery(event))
  return listParents(query)
})
