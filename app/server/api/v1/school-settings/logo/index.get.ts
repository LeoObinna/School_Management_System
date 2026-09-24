/**
 * GET /api/v1/school-settings/logo
 *
 * Streams the current school logo inline from R2. Branding is visible to
 * any authenticated user (it is part of the public settings subset), so
 * this only requires a valid session. 404 when no logo is set or the
 * stored object is missing. The URL is constant while the underlying
 * object key changes on replacement, so caching is kept short.
 */
import { defineEventHandler, createError } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { getSchoolSettings } from '~/server/services/school-settings'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  requireUser(event)
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
    { disposition: 'inline', cacheControl: 'private, max-age=300' },
  )
})
