/** PUT /api/v1/events/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { eventUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateEvent } from '~/server/services/events'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'events.manage')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(eventUpdateSchema, await readBody(event))
  const schoolEvent = await updateEvent(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'event.update',
    resource: 'event',
    resourceId: schoolEvent.id,
    description: `Updated event "${schoolEvent.title}".`,
  })
  return schoolEvent
})
