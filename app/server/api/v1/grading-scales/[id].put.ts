/** PUT /api/v1/grading-scales/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  gradingScaleUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateGradingScale } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(gradingScaleUpdateSchema, await readBody(event))
  const scale = await updateGradingScale(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'grading_scale.update',
    resource: 'grading_scale',
    resourceId: scale.id,
    description: `Updated grading scale "${scale.name}".`,
  })
  return scale
})
