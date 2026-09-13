/** GET /api/v1/admissions/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getApplication } from '~/server/services/admissions'

export default defineEventHandler((event) => {
  requirePermission(event, 'admissions.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getApplication(id)
})
