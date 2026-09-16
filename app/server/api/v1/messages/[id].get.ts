/** GET /api/v1/messages/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getMessage } from '~/server/services/communication'

export default defineEventHandler((event) => {
  const auth = requirePermission(event, 'messages.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getMessage(id, { userId: auth.user.id })
})
