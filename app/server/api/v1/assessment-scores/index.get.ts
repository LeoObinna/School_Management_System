/** GET /api/v1/assessment-scores */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { assessmentScoreListQuerySchema } from '~/shared/schemas'
import {
  getActor,
  listAssessmentScores,
} from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.view')
  const query = parseQueryData(
    assessmentScoreListQuerySchema,
    getQuery(event),
  )
  const actor = await getActor(auth, 'exam_results.view')
  return listAssessmentScores(query, actor)
})
