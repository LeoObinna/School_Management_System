/** POST /api/v1/enrollments */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { enrollmentCreateSchema } from '~/shared/schemas'
import { createEnrollment } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'enrollments.create')
  const data = parseBody(enrollmentCreateSchema, await readBody(event))
  const enrollment = await createEnrollment(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'enrollment.create',
    resource: 'enrollment',
    resourceId: enrollment.id,
    description: `Enrolled student ${enrollment.studentId} in ${enrollment.className}.`,
  })
  setResponseStatus(event, 201)
  return enrollment
})
