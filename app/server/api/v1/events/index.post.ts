/** POST /api/v1/events */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { eventCreateSchema } from '~/shared/schemas'
import { createEvent } from '~/server/services/events'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'events.manage')
  const data = parseBody(eventCreateSchema, await readBody(event))
  const schoolEvent = await createEvent(data, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'event.create',
    resource: 'event',
    resourceId: schoolEvent.id,
    description: `Created event "${schoolEvent.title}".`,
  })
  setResponseStatus(event, 201)
  return schoolEvent
})
