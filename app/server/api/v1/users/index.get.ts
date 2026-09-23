/** GET /api/v1/users — admin user listing (users.view). */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { userListQuerySchema } from '~/shared/schemas'
import { listUsers } from '~/server/services/users'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'users.view')
  const query = parseQueryData(userListQuerySchema, getQuery(event))
  return listUsers(query)
})
