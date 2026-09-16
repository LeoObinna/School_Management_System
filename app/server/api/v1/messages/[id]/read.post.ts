/** POST /api/v1/messages/:id/read */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { markMessageRead } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'messages.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const message = await markMessageRead(id, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'message.mark_read',
    resource: 'message',
    resourceId: id,
    description: `Marked message as read.`,
  })
  return message
})
