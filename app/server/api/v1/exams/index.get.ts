/** GET /api/v1/exams */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseQueryData } from '~/server/utils/validation'
import { examListQuerySchema } from '~/shared/schemas'
import { listExams } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exams.view')
  const query = parseQueryData(examListQuerySchema, getQuery(event))
  // `exams.create` is admin-only; teachers are scoped to exams for
  // classes they teach, students/parents to their enrolled/children's
  // classes (Phase 12). Staff see everything.
  const actor = await resolveActorProfile(event, 'exams.create')
  return listExams(query, actor)
})
