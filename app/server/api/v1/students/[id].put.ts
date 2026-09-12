/** PUT /api/v1/students/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, studentUpdateSchema } from '~/shared/schemas'
import { updateStudent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'students.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(studentUpdateSchema, await readBody(event))
  const student = await updateStudent(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student.update',
    resource: 'student',
    resourceId: student.id,
    description: `Updated student ${student.admissionNumber}.`,
  })
  return student
})
