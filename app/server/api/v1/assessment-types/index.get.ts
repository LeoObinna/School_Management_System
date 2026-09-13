/** GET /api/v1/assessment-types */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { assessmentTypeListQuerySchema } from '~/shared/schemas'
import { listAssessmentTypes } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exams.view')
  const query = parseQueryData(
    assessmentTypeListQuerySchema,
    getQuery(event),
  )
  return listAssessmentTypes(query)
})
