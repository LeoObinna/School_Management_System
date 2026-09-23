/** PUT /api/v1/resources/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  idParamSchema,
  resourceUpdateSchema,
} from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { updateResource } from '~/server/services/resources'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'resources.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(resourceUpdateSchema, await readBody(event))
  const actor = await resolveActorProfile(event, 'resources.manage')
  const resource = await updateResource(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'resource.update',
    resource: 'learning_resource',
    resourceId: id,
    description: `Updated resource "${resource.title}".`,
  })
  return resource
})
