/** GET /api/v1/parents/me — self-service dashboard payload */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getParentSelf } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'dashboard.view')
  const actor = await resolveActorProfile(event, 'dashboard.view')
  return getParentSelf(actor)
})
