/**
 * GET /api/v1/public/gallery/albums — published albums with image counts
 * and cover URLs (Phase 18B). Unauthenticated; edge-cacheable.
 */
import { defineEventHandler, getQuery } from 'h3'
import { parseQueryData } from '~/server/utils/validation'
import { publicAlbumsListQuerySchema } from '~/shared/schemas'
import { getPublicAlbums } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  const query = parseQueryData(publicAlbumsListQuerySchema, getQuery(event))
  setPublicCacheHeaders(event, 120)
  return await getPublicAlbums(query)
})
