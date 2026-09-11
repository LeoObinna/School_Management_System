/**
 * GET /api/v1/auth/me
 *
 * Returns the current session (user, roles, permissions, csrf token)
 * or 401. Roles/permissions are loaded server-side — never from the
 * client.
 */
import { defineEventHandler, createError } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { currentSessionResponse } from '~/server/utils/auth/session-service'

export default defineEventHandler(async (event) => {
  requireUser(event)
  const session = await currentSessionResponse(event)
  if (!session) {
    // requireUser passed, so this should be unreachable.
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return session
})
