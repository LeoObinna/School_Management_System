/** GET /api/v1/assignments */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { assignmentListQuerySchema } from '~/shared/schemas'
import { getActor, listAssignments } from '~/server/services/assignments'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.view')
  const query = parseQueryData(assignmentListQuerySchema, getQuery(event))
  const actor = await getActor(auth)
  return listAssignments(query, actor)
})
