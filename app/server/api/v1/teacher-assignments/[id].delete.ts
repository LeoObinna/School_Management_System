/**
 * DELETE /api/v1/teacher-assignments/{id}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { removeAssignment } from '~/server/services/teacher-academics'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teacher_assignments.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  await removeAssignment(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher_assignment.delete',
    resource: 'teacher_assignment',
    resourceId: id,
    description: 'Removed a teacher assignment.',
  })
  return { message: 'Teacher assignment removed.' }
})
