/**
 * GET /api/v1/academic-sessions
 * Paginated academic sessions (filters: search, isCurrent, isActive).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { academicSessionListQuerySchema } from '~/shared/schemas'
import { listSessions } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'academic_sessions.view')
  const query = parseQueryData(
    academicSessionListQuerySchema,
    getQuery(event),
  )
  return listSessions(query)
})
