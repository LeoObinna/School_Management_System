/** GET /api/v1/students/:id/parents */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { listStudentParents } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return { data: await listStudentParents(id) }
})
