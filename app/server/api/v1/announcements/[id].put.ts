/** PUT /api/v1/announcements/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { announcementUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(announcementUpdateSchema, await readBody(event))
  const announcement = await updateAnnouncement(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.update',
    resource: 'announcement',
    resourceId: announcement.id,
    description: `Updated announcement "${announcement.title}".`,
  })
  return announcement
})
