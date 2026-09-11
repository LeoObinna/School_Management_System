/**
 * Session issuance / serialization helpers shared by the auth routes.
 */
import type { H3Event } from 'h3'
import type { AuthSessionResponse } from '../../../shared/types'
import { loadUserGrants, getAuthContext } from './context'
import {
  signToken,
  deriveCsrfToken,
  newSessionId,
  SESSION_TTL_SECONDS,
} from './tokens'
import {
  setSessionCookie,
  setCsrfCookie,
  isSecureRequest,
} from './cookies'

/**
 * Creates a signed session for an authenticated user, sets the session
 * and CSRF cookies, populates the request context and returns the
 * payload sent to the client. Returns null if the user no longer exists
 * or is inactive.
 */
export async function issueSession(
  event: H3Event,
  userId: string,
  remember: boolean,
): Promise<AuthSessionResponse | null> {
  const grants = await loadUserGrants(userId)
  if (!grants) {
    return null
  }

  const config = useRuntimeConfig(event)
  const sessionId = newSessionId()
  const maxAgeSeconds = remember
    ? SESSION_TTL_SECONDS.remember
    : SESSION_TTL_SECONDS.default

  const token = await signToken(
    config.sessionSecret,
    { sub: userId, sid: sessionId, rem: remember },
    { purpose: 'session', maxAgeSeconds },
  )

  const secure = isSecureRequest(event)
  setSessionCookie(event, token, { remember, secure, maxAgeSeconds })

  const csrfToken = await deriveCsrfToken(config.sessionSecret, sessionId)
  setCsrfCookie(event, csrfToken, secure)

  event.context.auth = { ...grants, sessionId }

  return {
    user: grants.user,
    roles: grants.roles as AuthSessionResponse['roles'],
    permissions: grants.permissions,
    csrfToken,
  }
}

/** Builds the /me payload from the current request's auth context. */
export async function currentSessionResponse(
  event: H3Event,
): Promise<AuthSessionResponse | null> {
  const auth = getAuthContext(event)
  if (!auth) {
    return null
  }
  const csrfToken = await deriveCsrfToken(
    useRuntimeConfig(event).sessionSecret,
    auth.sessionId,
  )
  return {
    user: auth.user,
    roles: auth.roles as AuthSessionResponse['roles'],
    permissions: auth.permissions,
    csrfToken,
  }
}
