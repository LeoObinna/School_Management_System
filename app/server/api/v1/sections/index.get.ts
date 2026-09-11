/**
 * GET /api/v1/sections
 * Paginated sections (filters: classId, isActive, search).
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { sectionListQuerySchema } from '~/shared/schemas'
import { listSections } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'sections.view')
  const query = parseQueryData(sectionListQuerySchema, getQuery(event))
  return listSections(query)
})
