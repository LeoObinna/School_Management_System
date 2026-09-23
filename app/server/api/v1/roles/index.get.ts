/** GET /api/v1/roles — list 5 roles + permission counts (roles.view). */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { listRoles } from '~/server/services/users'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'roles.view')
  const roles = await listRoles()
  return { data: roles, total: roles.length }
})
