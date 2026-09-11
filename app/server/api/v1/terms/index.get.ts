/**
 * GET /api/v1/terms
 * Paginated terms (filters: sessionId, isCurrent, isActive, search).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { termListQuerySchema } from '~/shared/schemas'
import { listTerms } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'terms.view')
  const query = parseQueryData(termListQuerySchema, getQuery(event))
  return listTerms(query)
})
