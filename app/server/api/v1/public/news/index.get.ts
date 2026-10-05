/**
 * GET /api/v1/public/news — published, audience-all announcements as
 * public news items (Phase 18B). Unauthenticated; edge-cacheable.
 */
import { defineEventHandler, getQuery } from 'h3'
import { parseQueryData } from '~/server/utils/validation'
import { publicNewsListQuerySchema } from '~/shared/schemas'
import { getPublicNews } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  const query = parseQueryData(publicNewsListQuerySchema, getQuery(event))
  setPublicCacheHeaders(event, 120)
  return await getPublicNews(query)
})
