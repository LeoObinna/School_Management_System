/** GET /api/v1/parents/me/children/:studentId/results?sessionId&termId */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import { idParamSchema, myChildResultsQuerySchema } from '~/shared/schemas'
import { getChildResults } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'exam_results.view')
  const { id: studentId } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'studentId'),
  })
  const query = parseQueryData(myChildResultsQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'exam_results.view')
  return getChildResults(studentId, query, actor)
})
