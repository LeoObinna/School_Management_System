/** POST /api/v1/announcements/:id/publish */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { publishAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.publish')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const result = await publishAnnouncement(id, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.publish',
    resource: 'announcement',
    resourceId: result.announcement.id,
    description: `Published announcement "${result.announcement.title}" (${result.notified} notifications sent).`,
  })
  return result
})
