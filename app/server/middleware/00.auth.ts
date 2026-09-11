/**
 * Global auth middleware (runs before every Nitro route).
 *
 * 1. Attaches the verified auth context (user/roles/permissions) when a
 *    valid session cookie is present. Invalid/expired -> anonymous.
 * 2. Enforces double-submit CSRF protection on state-changing /api
 *    requests that carry a session cookie. Unauthenticated endpoints
 *    (login, forgot/reset password) carry no ambient authority and are
 *    therefore exempt; a valid session plus a missing/mismatched token
 *    is rejected before the handler runs.
 */
import { defineEventHandler, getRequestHeader, getRequestURL, createError } from 'h3'
import { loadAuthContext } from '../utils/auth/context'
import { deriveCsrfToken } from '../utils/auth/tokens'
import { getSessionToken, CSRF_HEADER } from '../utils/auth/cookies'
import { timingSafeEqual, base64UrlToBytes } from '../utils/auth/encoding'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler(async (event) => {
  const auth = await loadAuthContext(event)
  if (!auth) {
    return
  }

  const method = event.method.toUpperCase()
  const pathname = getRequestURL(event).pathname
  const isApiMutation =
    pathname.startsWith('/api/') && !SAFE_METHODS.has(method)

  if (!isApiMutation) {
    return
  }

  // Ambient session present on a mutating request: require a matching
  // double-submit CSRF token.
  const sessionToken = getSessionToken(event)
  if (!sessionToken) {
    return
  }

  const provided = getRequestHeader(event, CSRF_HEADER)
  const expected = await deriveCsrfToken(
    useRuntimeConfig(event).sessionSecret,
    auth.sessionId,
  )

  let matches = false
  if (provided) {
    try {
      matches = timingSafeEqual(
        base64UrlToBytes(provided),
        base64UrlToBytes(expected),
      )
    } catch {
      matches = false
    }
  }

  if (!matches) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'CSRF token missing or invalid.',
    })
  }
})
