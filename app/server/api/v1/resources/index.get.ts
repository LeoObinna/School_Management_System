/** GET /api/v1/resources */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { resourceListQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listResources } from '~/server/services/resources'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'resources.view')
  const query = parseQueryData(resourceListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'resources.manage')
  return listResources(query, actor)
})
