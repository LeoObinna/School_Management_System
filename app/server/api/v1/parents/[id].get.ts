/** GET /api/v1/parents/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getParentOrThrow } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'parents.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getParentOrThrow(id)
})
