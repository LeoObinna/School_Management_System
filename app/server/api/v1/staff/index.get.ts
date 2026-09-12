/** GET /api/v1/staff */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { staffListQuerySchema } from '~/shared/schemas'
import { listStaff } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'staff.view')
  const query = parseQueryData(staffListQuerySchema, getQuery(event))
  return listStaff(query)
})
