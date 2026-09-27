/** POST /api/v1/exam-results/bulk — commit valid CSV score rows (Phase 16D). */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { examScoreCsvBulkSchema } from '~/shared/schemas'
import { getActor } from '~/server/services/exams'
import { bulkCommitExamScores } from '~/server/services/exam-results-bulk'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.enter')
  const data = parseBody(examScoreCsvBulkSchema, await readBody(event))
  const actor = await getActor(auth)
  const result = await bulkCommitExamScores(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam_score.bulk_csv_enter',
    resource: 'exam_score',
    resourceId: data.examId,
    description: `Bulk entered ${result.committed} exam scores from CSV for exam ${data.examId}.`,
  })
  return result
})
