/** GET /api/v1/exam-results/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getPublication } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exam_results.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getPublication(id)
})
