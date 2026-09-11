/**
 * DELETE /api/v1/teacher-subjects/{teacherId}/{subjectId}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { removeTeacherSubject } from '~/server/services/teacher-academics'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({
  teacherId: uuidSchema,
  subjectId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'teacher_assignments.manage')
  const params = parseInput(paramsSchema, getRouterParams(event))
  await removeTeacherSubject(params.teacherId, params.subjectId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'teacher_subject.delete',
    resource: 'teacher_subject',
    resourceId: `${params.teacherId}:${params.subjectId}`,
    description: 'Removed a teacher subject link.',
  })
  return { message: 'Teacher subject removed.' }
})
