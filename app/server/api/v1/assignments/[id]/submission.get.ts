/** GET /api/v1/assignments/:id/submission  (the caller's own) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  getMySubmission,
} from '~/server/services/assignments'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'submissions.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth)
  const submission = await getMySubmission(id, actor)
  return submission ?? { data: null }
})
