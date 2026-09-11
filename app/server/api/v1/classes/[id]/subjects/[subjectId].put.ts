/**
 * PUT /api/v1/classes/{id}/subjects/{subjectId}
 * Updates a class-subject link (compulsory flag, max score).
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { classSubjectUpdateSchema, uuidSchema } from '~/shared/schemas'
import { updateClassSubject } from '~/server/services/academic-structure'
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
  const data = parseBody(classSubjectUpdateSchema, await readBody(event))
  const link = await updateClassSubject(params.id, params.subjectId, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class_subject.update',
    resource: 'class_subject',
    resourceId: `${link.classId}:${link.subjectId}`,
    description: 'Updated a class subject link.',
  })
  return link
})
