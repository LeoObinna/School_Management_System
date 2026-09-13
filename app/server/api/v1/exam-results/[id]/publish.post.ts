/** POST /api/v1/exam-results/:id/publish */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  publishPublication,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.publish')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'exam_results.publish')
  const publication = await publishPublication(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'result.publish',
    resource: 'result_publication',
    resourceId: publication.id,
    description: `Published results for ${publication.className}.`,
  })
  return publication
})
