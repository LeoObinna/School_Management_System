/** POST /api/v1/students */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { studentCreateSchema } from '~/shared/schemas'
import { createStudent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'students.create')
  const data = parseBody(studentCreateSchema, await readBody(event))
  const student = await createStudent(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student.create',
    resource: 'student',
    resourceId: student.id,
    description: `Created student ${student.admissionNumber}.`,
  })
  setResponseStatus(event, 201)
  return student
})
