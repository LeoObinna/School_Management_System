/** GET /api/v1/assignments */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { assignmentListQuerySchema } from '~/shared/schemas'
import { listAssignments } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'assignments.view')
  const query = parseQueryData(assignmentListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'assignments.create')
  return listAssignments(query, actor)
})
