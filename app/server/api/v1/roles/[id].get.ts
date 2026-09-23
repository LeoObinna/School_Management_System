/** GET /api/v1/roles/:id — role detail with permission slugs (roles.view). */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { roleIdParamSchema } from '~/shared/schemas'
import { getRoleDetailOrThrow } from '~/server/services/users'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'roles.view')
  const { id } = parseInput(roleIdParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getRoleDetailOrThrow(id)
})
