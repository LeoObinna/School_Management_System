/** GET /api/v1/events */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { eventListQuerySchema } from '~/shared/schemas'
import { listEvents } from '~/server/services/events'

export default defineEventHandler((event) => {
  requirePermission(event, 'events.view')
  const query = parseQueryData(eventListQuerySchema, getQuery(event))
  return listEvents(query)
})
