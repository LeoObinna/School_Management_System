/** POST /api/v1/exam-results/bulk-preview — per-row validation of CSV score rows (Phase 16D). */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { examScoreCsvBulkSchema } from '~/shared/schemas'
import { getActor } from '~/server/services/exams'
import { bulkPreviewExamScores } from '~/server/services/exam-results-bulk'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.enter')
  const data = parseBody(examScoreCsvBulkSchema, await readBody(event))
  const actor = await getActor(auth)
  return bulkPreviewExamScores(data, actor)
})
