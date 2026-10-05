/**
 * GET /api/v1/public/events?when=upcoming|past — published, audience-all
 * events (Phase 18B). Unauthenticated; edge-cacheable.
 */
import { defineEventHandler, getQuery } from 'h3'
import { parseQueryData } from '~/server/utils/validation'
import { publicEventsListQuerySchema } from '~/shared/schemas'
import { getPublicEvents } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  const query = parseQueryData(publicEventsListQuerySchema, getQuery(event))
  setPublicCacheHeaders(event, 120)
  return await getPublicEvents(query)
})
