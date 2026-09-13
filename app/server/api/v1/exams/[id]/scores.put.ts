/** PUT /api/v1/exams/:id/scores */
import {
  defineEventHandler,
  getRouterParam,
  readBody,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  examScoreBulkSchema,
  idParamSchema,
} from '~/shared/schemas'
import {
  bulkUpsertExamScores,
  getActor,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.enter')
  // Path :id is the examId, kept for context; the service targets
  // body.examSubjectId.
  parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(examScoreBulkSchema, await readBody(event))
  const actor = await getActor(auth)
  const result = await bulkUpsertExamScores(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam_score.bulk_enter',
    resource: 'exam_score',
    resourceId: data.examSubjectId,
    description: `Bulk entered ${result.count} exam scores for exam subject ${data.examSubjectId}.`,
  })
  return result
})
