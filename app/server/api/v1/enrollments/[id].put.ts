/** PUT /api/v1/enrollments/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { enrollmentUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateEnrollment } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'enrollments.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(enrollmentUpdateSchema, await readBody(event))
  const enrollment = await updateEnrollment(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'enrollment.update',
    resource: 'enrollment',
    resourceId: enrollment.id,
    description: `Updated enrollment ${id}.`,
  })
  return enrollment
})
