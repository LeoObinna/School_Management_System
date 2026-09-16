/** DELETE /api/v1/notifications/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteNotification } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'notifications.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  await deleteNotification(id, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'notification.delete',
    resource: 'notification',
    resourceId: id,
    description: `Deleted notification.`,
  })
})
