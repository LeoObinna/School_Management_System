/** POST /api/v1/grading-scales */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { gradingScaleCreateSchema } from '~/shared/schemas'
import { createGradingScale } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.create')
  const data = parseBody(gradingScaleCreateSchema, await readBody(event))
  const scale = await createGradingScale(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'grading_scale.create',
    resource: 'grading_scale',
    resourceId: scale.id,
    description: `Created grading scale "${scale.name}".`,
  })
  setResponseStatus(event, 201)
  return scale
})
