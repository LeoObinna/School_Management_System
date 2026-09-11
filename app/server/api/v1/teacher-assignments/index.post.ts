/**
 * POST /api/v1/teacher-assignments
 * Assigns a teacher to a class/[section] + subject for a session.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { teacherAssignmentCreateSchema } from '~/shared/schemas'
import { createAssignment } from '~/server/services/teacher-academics'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teacher_assignments.manage')
  const data = parseBody(
    teacherAssignmentCreateSchema,
    await readBody(event),
  )
  const assignment = await createAssignment(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher_assignment.create',
    resource: 'teacher_assignment',
    resourceId: assignment.id,
    description: `Assigned ${assignment.teacherName} to ${assignment.subjectName}.`,
  })
  setResponseStatus(event, 201)
  return assignment
})
