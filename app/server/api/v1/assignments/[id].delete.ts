/** DELETE /api/v1/assignments/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteAssignment } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import {
  deleteObject,
  getR2Bucket,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.delete')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  // Fail before touching the database when object storage is offline,
  // so metadata and bytes do not diverge.
  getR2Bucket(event)
  const { objectKeys } = await deleteAssignment(id, actor)
  for (const key of objectKeys) {
    await deleteObject(event, key)
  }
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assignment.delete',
    resource: 'assignment',
    resourceId: id,
    description: `Deleted assignment ${id} and ${objectKeys.length} stored file(s).`,
  })
  return { ok: true }
})
