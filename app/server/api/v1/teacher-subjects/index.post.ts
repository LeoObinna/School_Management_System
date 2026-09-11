/**
 * POST /api/v1/teacher-subjects
 * Links a teacher to a subject they can teach.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { teacherSubjectBodySchema } from '~/shared/schemas'
import { addTeacherSubject } from '~/server/services/teacher-academics'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teacher_assignments.manage')
  const data = parseBody(teacherSubjectBodySchema, await readBody(event))
  const link = await addTeacherSubject(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher_subject.create',
    resource: 'teacher_subject',
    resourceId: `${link.teacherId}:${link.subjectId}`,
    description: 'Linked a teacher to a subject.',
  })
  setResponseStatus(event, 201)
  return link
})
