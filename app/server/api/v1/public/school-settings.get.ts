/**
 * GET /api/v1/public/school-settings (Phase 18A)
 *
 * Unauthenticated identity/branding payload for the public website. In
 * addition to the authenticated public subset (name, motto, contact,
 * colors) it includes the bank transfer details shown on the fees page —
 * the UI hides the bank block unless all three fields are populated — and
 * a `logoUrl` pointing at the constant public streaming route when a logo
 * is configured. Reads through the shared KV-cached settings object, so
 * no extra D1 read per request.
 */
import { defineEventHandler } from 'h3'
import { getPublicSiteSettings } from '~/server/services/school-settings'
import { setPublicCacheHeaders } from '~/server/utils/cache'

export default defineEventHandler(async (event) => {
  // Settings change rarely and are already KV-cached for 60s; let edges
  // and browsers hold the payload for the same window.
  setPublicCacheHeaders(event, 60)
  return getPublicSiteSettings(event)
})
