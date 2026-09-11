/**
 * GET /api/v1/subjects
 * Paginated subjects (filters: isActive, search over name/code).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { subjectListQuerySchema } from '~/shared/schemas'
import { listSubjects } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'subjects.view')
  const query = parseQueryData(subjectListQuerySchema, getQuery(event))
  return listSubjects(query)
})
