/** GET /api/v1/parents/me/teachers — deduped teacher contacts (Phase 16B) */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listMyTeachers } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'messages.send')
  const actor = await resolveActorProfile(event, 'messages.send')
  return listMyTeachers(actor)
})
