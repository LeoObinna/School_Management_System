/** GET /api/v1/students/:id/results */
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
} from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import { idParamSchema, uuidSchema } from '~/shared/schemas'
import {
  getActor,
  getStudentResults,
} from '~/server/services/exams'

const resultsQuerySchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const { sessionId, termId } = parseQueryData(
    resultsQuerySchema,
    getQuery(event),
  )
  const actor = await getActor(auth, 'exam_results.view')
  return getStudentResults(id, sessionId, termId, actor)
})
