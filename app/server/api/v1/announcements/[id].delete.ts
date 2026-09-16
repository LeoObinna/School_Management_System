/** DELETE /api/v1/announcements/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteAnnouncement } from '~/server/services/communication'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'announcements.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  await deleteAnnouncement(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'announcement.delete',
    resource: 'announcement',
    resourceId: id,
    description: `Deleted announcement ${id}.`,
  })
})
