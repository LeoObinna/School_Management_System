/** GET /api/v1/parents/me/overview — per-child portal snapshot (Phase 16B) */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getParentOverview } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'dashboard.view')
  const actor = await resolveActorProfile(event, 'dashboard.view')
  return getParentOverview(actor)
})
