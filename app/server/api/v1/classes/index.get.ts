/**
 * GET /api/v1/classes
 * Paginated classes (filters: level, isActive, search).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { classListQuerySchema } from '~/shared/schemas'
import { listClasses } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'classes.view')
  const query = parseQueryData(classListQuerySchema, getQuery(event))
  return listClasses(query)
})
