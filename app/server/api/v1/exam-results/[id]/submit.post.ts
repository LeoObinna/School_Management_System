/** POST /api/v1/exam-results/:id/submit */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  submitPublication,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.submit')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'exam_results.submit')
  const publication = await submitPublication(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'result.submit',
    resource: 'result_publication',
    resourceId: publication.id,
    description: `Submitted results for ${publication.className} for approval.`,
  })
  return publication
})
