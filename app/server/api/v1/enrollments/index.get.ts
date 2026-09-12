/** GET /api/v1/enrollments */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { enrollmentListQuerySchema } from '~/shared/schemas'
import { listEnrollments } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'enrollments.view')
  const query = parseQueryData(enrollmentListQuerySchema, getQuery(event))
  return listEnrollments(query)
})
