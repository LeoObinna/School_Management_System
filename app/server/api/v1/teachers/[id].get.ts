/** GET /api/v1/teachers/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getTeacherOrThrow } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teachers.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getTeacherOrThrow(id)
})
