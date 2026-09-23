/** GET /api/v1/my/assignments — published work for the current student */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { myAssignmentListQuerySchema } from '~/shared/schemas'
import { listMyAssignments } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'assignments.view')
  const query = parseQueryData(
    myAssignmentListQuerySchema,
    getQuery(event),
  )
  const actor = await resolveActorProfile(event, 'assignments.create')
  return listMyAssignments(query, actor)
})
