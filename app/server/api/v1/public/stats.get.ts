/**
 * GET /api/v1/public/stats (Phase 18A)
 *
 * Unauthenticated aggregate counts (students, teachers, classes,
 * subjects) for the homepage statistics strip. Counts of active /
 * non-deleted rows only — no personal data is exposed. The payload is
 * KV-cached server-side and edge/browser-cacheable for five minutes.
 */
import { defineEventHandler } from 'h3'
import { getPublicStats } from '~/server/services/public'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  setPublicCacheHeaders(event, 300)
  return getPublicStats(event)
})
