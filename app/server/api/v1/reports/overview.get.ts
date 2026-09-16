/** GET /api/v1/reports/overview — school-wide counts (README §27, Phase 11). */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { overviewQuerySchema } from '~/shared/schemas'
import { getOverview } from '~/server/services/reports'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'reports.view')
  const query = parseQueryData(overviewQuerySchema, getQuery(event))
  return getOverview(query)
})
