/** GET /api/v1/notifications */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { notificationListQuerySchema } from '~/shared/schemas'
import { listNotifications } from '~/server/services/communication'

export default defineEventHandler((event) => {
  const auth = requirePermission(event, 'notifications.view')
  const query = parseQueryData(notificationListQuerySchema, getQuery(event))
  return listNotifications(query, { userId: auth.user.id })
})
