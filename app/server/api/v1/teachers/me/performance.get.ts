/** GET /api/v1/teachers/me/performance — published-score aggregates (Phase 16C) */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { teacherPerformanceQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getTeacherPerformance } from '~/server/services/teachers-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exam_results.view')
  const query = parseQueryData(teacherPerformanceQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'exam_results.view')
  return getTeacherPerformance(query, actor)
})
