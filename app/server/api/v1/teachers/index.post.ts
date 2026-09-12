/** POST /api/v1/teachers */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { teacherCreateSchema } from '~/shared/schemas'
import { createTeacher } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teachers.create')
  const data = parseBody(teacherCreateSchema, await readBody(event))
  const teacher = await createTeacher(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher.create',
    resource: 'teacher',
    resourceId: teacher.id,
    description: `Created teacher ${teacher.staffNumber}.`,
  })
  setResponseStatus(event, 201)
  return teacher
})
