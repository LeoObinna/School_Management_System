/**
 * GET /api/v1/public/gallery/albums/:id — one published album with its
 * images (Phase 18B). Generic 404 for unpublished albums and unknown
 * ids. Unauthenticated; edge-cacheable.
 */
import { defineEventHandler, getRouterParam } from 'h3'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getPublicAlbum } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  setPublicCacheHeaders(event, 300)
  return await getPublicAlbum(id)
})
