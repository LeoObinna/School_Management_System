/**
 * PATCH /api/v1/contact-messages/{id}/status — mark read / archive
 * (Phase 18C). Audited staff action.
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { contactMessageStatusUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateContactMessageStatus } from '~/server/services/contact-messages'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'contact_messages.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(contactMessageStatusUpdateSchema, await readBody(event))
  const message = await updateContactMessageStatus(id, data.status)
  await writeAudit(event, {
    userId: auth.user.id,
    action: `contact_message.${data.status === 'read' ? 'mark_read' : 'archive'}`,
    resource: 'contact_message',
    resourceId: message.id,
    description: `Marked contact message from ${message.name} as ${data.status}.`,
  })
  return message
})
