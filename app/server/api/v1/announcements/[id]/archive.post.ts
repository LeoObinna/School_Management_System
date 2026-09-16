/** POST /api/v1/announcements/:id/archive */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { archiveAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.publish')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const announcement = await archiveAnnouncement(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.archive',
    resource: 'announcement',
    resourceId: announcement.id,
    description: `Archived announcement "${announcement.title}".`,
  })
  return announcement
})
