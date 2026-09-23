/** GET /api/v1/assignments/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getAssignmentForActor } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'assignments.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  return getAssignmentForActor(id, actor)
})
