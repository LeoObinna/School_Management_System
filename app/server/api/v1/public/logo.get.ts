/**
 * GET /api/v1/public/logo (Phase 18A)
 *
 * Unauthenticated inline stream of the current school logo from R2, used
 * by the public website header/footer. Unlike the authenticated
 * /api/v1/school-settings/logo route this carries a long public cache
 * policy; the URL is constant while the underlying object key changes on
 * replacement, so a same-day swap may briefly serve the previous logo —
 * acceptable for branding. 404 when no logo is set.
 */
import { defineEventHandler, createError } from 'h3'
import { getSchoolSettings } from '~/server/services/school-settings'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const settings = await getSchoolSettings(event)
  if (!settings.logoKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'No school logo has been set.',
    })
  }
  // Content type comes from the object's stored HTTP metadata (set at
  // upload time); the extension only drives the download filename.
  const ext = settings.logoKey.split('.').pop()?.toLowerCase()
  return streamObject(
    event,
    settings.logoKey,
    ext ? `school-logo.${ext}` : 'school-logo',
    undefined,
    {
      disposition: 'inline',
      cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
    },
  )
})
