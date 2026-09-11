/**
 * GET /api/v1/classes/{id}
 * Class detail including its sections and offered subjects.
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getClassDetail } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'classes.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  return getClassDetail(id)
})
