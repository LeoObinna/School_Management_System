/** DELETE /api/v1/resources/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { deleteResource } from '~/server/services/resources'
import {
  assertR2Available,
  deleteObject,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'resources.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'resources.manage')
  // Fail before touching the database when object storage is offline,
  // so metadata and bytes do not diverge.
  assertR2Available(event)
  const objectKey = await deleteResource(id, actor)
  await deleteObject(event, objectKey)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'resource.delete',
    resource: 'learning_resource',
    resourceId: id,
    description: `Deleted resource ${id} and its stored file.`,
  })
  return { ok: true }
})
