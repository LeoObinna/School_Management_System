/**
 * POST /api/v1/auth/logout
 *
 * Clears session/CSRF cookies. CSRF middleware guarantees the request
 * carries a valid session + token before this runs.
 */
import { defineEventHandler } from 'h3'
import { clearSessionCookie } from '~/server/utils/auth/cookies'
import { getAuthContext } from '~/server/utils/auth/context'
import { revokeSession } from '~/server/utils/auth/revocation'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = getAuthContext(event)

  // Server-side revoke BEFORE clearing the cookie: any replay of the
  // cookie after this response is rejected via EDGE_KV (Phase 13).
  if (auth) {
    await revokeSession(event, auth.sessionId)
  }
  clearSessionCookie(event)

  if (auth) {
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'auth.logout',
      resource: 'auth',
      resourceId: auth.user.id,
      description: 'User signed out.',
    })
  }

  return { message: 'Signed out.' }
})
