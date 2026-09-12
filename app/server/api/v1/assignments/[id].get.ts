/** GET /api/v1/assignments/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  getAssignmentForActor,
} from '~/server/services/assignments'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth)
  return getAssignmentForActor(id, actor)
})
