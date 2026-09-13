/** PUT /api/v1/assessment-scores/bulk */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { assessmentScoreBulkSchema } from '~/shared/schemas'
import {
  bulkUpsertAssessmentScores,
  getActor,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.enter')
  const data = parseBody(
    assessmentScoreBulkSchema,
    await readBody(event),
  )
  const actor = await getActor(auth)
  const result = await bulkUpsertAssessmentScores(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assessment_score.bulk_enter',
    resource: 'assessment_score',
    resourceId: data.subjectId,
    description: `Bulk entered ${result.count} assessment scores for subject ${data.subjectId}.`,
  })
  return result
})
