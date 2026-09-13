/** GET /api/v1/exam-results */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { resultPublicationListQuerySchema } from '~/shared/schemas'
import { listPublications } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exam_results.view')
  const query = parseQueryData(
    resultPublicationListQuerySchema,
    getQuery(event),
  )
  return listPublications(query)
})
