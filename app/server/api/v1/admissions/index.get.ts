/** GET /api/v1/admissions */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { applicationListQuerySchema } from '~/shared/schemas'
import { listApplications } from '~/server/services/admissions'

export default defineEventHandler((event) => {
  requirePermission(event, 'admissions.view')
  const query = parseQueryData(applicationListQuerySchema, getQuery(event))
  return listApplications(query)
})
