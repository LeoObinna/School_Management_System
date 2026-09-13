/** POST /api/v1/assessment-scores */
import {
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { assessmentScoreUpsertSchema } from '~/shared/schemas'
import {
  getActor,
  upsertAssessmentScore,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.enter')
  const data = parseBody(
    assessmentScoreUpsertSchema,
    await readBody(event),
  )
  const actor = await getActor(auth)
  const score = await upsertAssessmentScore(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assessment_score.upsert',
    resource: 'assessment_score',
    resourceId: score.id,
    description: `Recorded ${data.score} for ${score.studentName} in ${score.subjectName}.`,
  })
  setResponseStatus(event, 201)
  return score
})
