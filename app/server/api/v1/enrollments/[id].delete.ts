/** DELETE /api/v1/enrollments/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { removeEnrollment } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'enrollments.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  await removeEnrollment(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'enrollment.delete',
    resource: 'enrollment',
    resourceId: id,
    description: `Removed enrollment ${id}.`,
  })
  return { message: 'Enrollment removed.' }
})
