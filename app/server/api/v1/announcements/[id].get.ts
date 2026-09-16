/** GET /api/v1/announcements/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getAnnouncement } from '~/server/services/communication'

export default defineEventHandler((event) => {
  requirePermission(event, 'announcements.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getAnnouncement(id)
})
