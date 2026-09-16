/** GET /api/v1/announcements */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { announcementListQuerySchema } from '~/shared/schemas'
import { listAnnouncements } from '~/server/services/communication'

export default defineEventHandler((event) => {
  requirePermission(event, 'announcements.view')
  const query = parseQueryData(announcementListQuerySchema, getQuery(event))
  return listAnnouncements(query)
})
