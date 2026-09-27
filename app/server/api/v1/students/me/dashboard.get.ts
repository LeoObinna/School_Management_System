/** GET /api/v1/students/me/dashboard — student-portal landing payload (Phase 16A) */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getStudentDashboard } from '~/server/services/students-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'dashboard.view')
  const actor = await resolveActorProfile(event, 'dashboard.view')
  return getStudentDashboard(actor)
})
