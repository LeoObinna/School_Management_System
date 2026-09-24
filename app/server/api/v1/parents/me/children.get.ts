/** GET /api/v1/parents/me/children — roster for the calling parent */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listMyChildren } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const actor = await resolveActorProfile(event, 'students.view')
  return listMyChildren(actor)
})
