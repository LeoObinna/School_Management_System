/** GET /api/v1/students/me — self-service dashboard payload */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getStudentSelf } from '~/server/services/students-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'dashboard.view')
  const actor = await resolveActorProfile(event, 'dashboard.view')
  return getStudentSelf(actor)
})
