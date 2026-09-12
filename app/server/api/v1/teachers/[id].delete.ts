/** DELETE /api/v1/teachers/:id (deactivates the teacher) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateTeacher } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teachers.delete')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const teacher = await deactivateTeacher(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher.deactivate',
    resource: 'teacher',
    resourceId: teacher.id,
    description: `Deactivated teacher ${teacher.staffNumber}.`,
  })
  return { message: 'Teacher deactivated.' }
})
