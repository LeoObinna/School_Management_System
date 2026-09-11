/**
 * Server-side authorization (README §8, §25).
 *
 * Route handlers call {@link requireUser} / {@link requirePermission};
 * these are authoritative and are the only enforcement points. Client
 * route guards are UX-only.
 */
import { createError, type H3Event } from 'h3'
import { getAuthContext, type AuthContext } from './context'
import { hasPermission } from './permissions'

/** Returns the authenticated context or throws 401. */
export function requireUser(event: H3Event): AuthContext {
  const auth = getAuthContext(event)
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication is required.',
    })
  }
  return auth
}

/** Requires an authenticated user holding `permission`, else 401/403. */
export function requirePermission(
  event: H3Event,
  permission: string,
): AuthContext {
  const auth = requireUser(event)
  if (!hasPermission(auth, permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have permission to perform this action.',
    })
  }
  return auth
}

/** Requires the authenticated user to have one of the given roles. */
export function requireRole(event: H3Event, ...roles: string[]): AuthContext {
  const auth = requireUser(event)
  const allowed = new Set(roles)
  if (!auth.roles.some((role) => allowed.has(role))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Your role cannot perform this action.',
    })
  }
  return auth
}
