/** PUT /api/v1/teachers/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, teacherUpdateSchema } from '~/shared/schemas'
import { updateTeacher } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teachers.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(teacherUpdateSchema, await readBody(event))
  const teacher = await updateTeacher(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher.update',
    resource: 'teacher',
    resourceId: teacher.id,
    description: `Updated teacher ${teacher.staffNumber}.`,
  })
  return teacher
})
