/** DELETE /api/v1/students/:id (archives the student) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { archiveStudent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'students.delete')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const student = await archiveStudent(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student.archive',
    resource: 'student',
    resourceId: student.id,
    description: `Archived student ${student.admissionNumber}.`,
  })
  return { message: 'Student archived.' }
})
