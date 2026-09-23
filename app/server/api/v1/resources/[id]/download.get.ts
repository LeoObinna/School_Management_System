/** GET /api/v1/resources/:id/download */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getResourceForActor } from '~/server/services/resources'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'resources.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'resources.manage')
  const access = await getResourceForActor(id, actor)
  return streamObject(
    event,
    access.objectKey,
    access.resource.fileName,
    access.resource.mimeType,
  )
})
