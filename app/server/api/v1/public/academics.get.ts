/**
 * GET /api/v1/public/academics — current session/terms and the active
 * class structure with subject names (Phase 18B). No people data.
 * Unauthenticated; KV-cached server-side and edge-cacheable.
 */
import { defineEventHandler } from 'h3'
import { getPublicAcademics } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  setPublicCacheHeaders(event, 300)
  return await getPublicAcademics(event)
})
