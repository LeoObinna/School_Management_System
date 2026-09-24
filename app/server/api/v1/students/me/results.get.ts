/** GET /api/v1/students/me/results — published results for the calling student */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { myResultsQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getMyResults } from '~/server/services/students-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exam_results.view')
  const query = parseQueryData(myResultsQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'exam_results.enter')
  return getMyResults(query, actor)
})
