/** GET /api/v1/resources */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { resourceListQuerySchema } from '~/shared/schemas'
import { getActor } from '~/server/services/assignments'
import { listResources } from '~/server/services/resources'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'resources.view')
  const query = parseQueryData(resourceListQuerySchema, getQuery(event))
  const actor = await getActor(auth, 'resources.manage')
  return listResources(query, actor)
})
