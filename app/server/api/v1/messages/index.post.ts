/** POST /api/v1/messages */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { messageCreateSchema } from '~/shared/schemas'
import { sendMessage } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'messages.send')
  const data = parseBody(messageCreateSchema, await readBody(event))
  const message = await sendMessage(data, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'message.send',
    resource: 'message',
    resourceId: message.id,
    description: `Sent message to ${message.recipientEmail ?? message.recipientId}.`,
  })
  setResponseStatus(event, 201)
  return message
})
