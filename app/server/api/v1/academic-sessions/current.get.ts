/**
 * GET /api/v1/academic-sessions/current
 * The session flagged current, or 404 when none is set.
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getCurrentSession } from '~/server/services/academic-structure'
import { smsNotFound } from '~/server/utils/http-errors'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'academic_sessions.view')
  const session = await getCurrentSession()
  if (!session) {
    throw smsNotFound('No current academic session.')
  }
  return session
})
