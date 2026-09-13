/** GET /api/v1/exams/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getExam } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exams.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getExam(id)
})
