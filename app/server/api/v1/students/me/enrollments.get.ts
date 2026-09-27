/** GET /api/v1/students/me/enrollments — view-only enrollment history (Phase 16A) */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { smsNotFound } from '~/server/utils/http-errors'
import { listEnrollments } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'dashboard.view')
  const actor = await resolveActorProfile(event, 'enrollments.view')
  if (!actor.studentId) {
    throw smsNotFound('No student profile linked to this account.')
  }
  // studentId comes from the actor, never the client — a student can
  // only ever list their own enrollment history. page/perPage/order are
  // required by the query type; listEnrollments returns the full
  // history unpaginated.
  return listEnrollments({
    studentId: actor.studentId,
    page: 1,
    perPage: 200,
    order: 'asc',
  })
})
