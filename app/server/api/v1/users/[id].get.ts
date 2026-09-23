/** GET /api/v1/users/:id (users.view). */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getUserOrThrow } from '~/server/services/users'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'users.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getUserOrThrow(id)
})
