/**
 * DELETE /api/v1/classes/{id}/subjects/{subjectId}
 * Removes a subject from a class's offer list.
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { removeClassSubject } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

const classSubjectParamsSchema = z.object({
  id: uuidSchema,
  subjectId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'class_subjects.manage')
  const params = parseInput(
    classSubjectParamsSchema,
    getRouterParams(event),
  )
  await removeClassSubject(params.id, params.subjectId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class_subject.delete',
    resource: 'class_subject',
    resourceId: `${params.id}:${params.subjectId}`,
    description: 'Removed a subject from a class.',
  })
  return { message: 'Class subject removed.' }
})
