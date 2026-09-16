/** DELETE /api/v1/events/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteEvent } from '~/server/services/events'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'events.manage')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  await deleteEvent(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'event.delete',
    resource: 'event',
    resourceId: id,
    description: `Deleted event ${id}.`,
  })
})
