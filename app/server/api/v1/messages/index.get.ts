/** GET /api/v1/messages */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { messageListQuerySchema } from '~/shared/schemas'
import { listMessages } from '~/server/services/communication'

export default defineEventHandler((event) => {
  const auth = requirePermission(event, 'messages.view')
  const query = parseQueryData(messageListQuerySchema, getQuery(event))
  return listMessages(query, { userId: auth.user.id })
})
