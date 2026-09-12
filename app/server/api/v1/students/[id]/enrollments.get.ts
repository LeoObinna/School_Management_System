/** GET /api/v1/students/:id/enrollments */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { listEnrollments } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'enrollments.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return listEnrollments({ studentId: id, page: 1, perPage: 100, order: 'asc' })
})
