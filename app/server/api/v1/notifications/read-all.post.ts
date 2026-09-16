/** POST /api/v1/notifications/read-all */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { markAllNotificationsRead } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'notifications.view')
  const result = await markAllNotificationsRead({ userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'notification.mark_all_read',
    resource: 'notification',
    description: `Marked ${result.updated} notifications as read.`,
  })
  return result
})
