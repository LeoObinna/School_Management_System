/** GET /api/v1/staff/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getStaffOrThrow } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'staff.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getStaffOrThrow(id)
})
