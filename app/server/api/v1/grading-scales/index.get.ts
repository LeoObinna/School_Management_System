/** GET /api/v1/grading-scales */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { gradingScaleListQuerySchema } from '~/shared/schemas'
import { listGradingScales } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exams.view')
  const query = parseQueryData(
    gradingScaleListQuerySchema,
    getQuery(event),
  )
  return listGradingScales(query)
})
