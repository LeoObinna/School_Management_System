/** POST /api/v1/announcements */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { announcementCreateSchema } from '~/shared/schemas'
import { createAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.create')
  const data = parseBody(announcementCreateSchema, await readBody(event))
  const announcement = await createAnnouncement(data, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.create',
    resource: 'announcement',
    resourceId: announcement.id,
    description: `Created announcement "${announcement.title}".`,
  })
  setResponseStatus(event, 201)
  return announcement
})
