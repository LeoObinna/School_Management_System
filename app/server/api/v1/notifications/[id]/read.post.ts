/** POST /api/v1/notifications/:id/read */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { markNotificationRead } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'notifications.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const notification = await markNotificationRead(id, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'notification.mark_read',
    resource: 'notification',
    resourceId: id,
    description: `Marked notification as read.`,
  })
  return notification
})
