/** GET /api/v1/assignments/:id/submission  (the caller's own) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getMySubmission } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'submissions.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  const submission = await getMySubmission(id, actor)
  return submission ?? { data: null }
})
