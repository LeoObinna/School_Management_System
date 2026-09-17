/** POST /api/v1/announcements/:id/publish */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getNotificationQueue } from '~/server/utils/notifications-queue'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { publishAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.publish')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  // Null under plain Node dev (fan-out runs inline); the Workers queue
  // binding drives the async, idempotent consumer path.
  const queue = getNotificationQueue(event)
  const result = await publishAnnouncement(
    id,
    { userId: auth.user.id },
    queue,
  )
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.publish',
    resource: 'announcement',
    resourceId: result.announcement.id,
    description: `Published announcement "${result.announcement.title}" (${result.notified} recipients; fan-out ${queue ? 'queued' : 'sent inline'}).`,
  })
  return result
})
