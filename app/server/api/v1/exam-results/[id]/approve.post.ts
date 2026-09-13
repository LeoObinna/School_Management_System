/** POST /api/v1/exam-results/:id/approve */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  approvePublication,
  getActor,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.approve')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'exam_results.approve')
  const publication = await approvePublication(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'result.approve',
    resource: 'result_publication',
    resourceId: publication.id,
    description: `Approved results for ${publication.className}.`,
  })
  return publication
})
