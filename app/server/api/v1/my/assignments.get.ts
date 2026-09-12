/** GET /api/v1/my/assignments — published work for the current student */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { myAssignmentListQuerySchema } from '~/shared/schemas'
import {
  getActor,
  listMyAssignments,
} from '~/server/services/assignments'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.view')
  const query = parseQueryData(
    myAssignmentListQuerySchema,
    getQuery(event),
  )
  const actor = await getActor(auth)
  return listMyAssignments(query, actor)
})
