/**
 * POST /api/v1/classes/{id}/subjects
 * Links a subject to the class (marks it as offered).
 */
import { defineEventHandler, getRouterParams, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { classSubjectBodySchema, idParamSchema } from '~/shared/schemas'
import { addClassSubject } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'class_subjects.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(classSubjectBodySchema, await readBody(event))
  const link = await addClassSubject(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class_subject.create',
    resource: 'class_subject',
    resourceId: `${id}:${link.subjectId}`,
    description: 'Linked a subject to a class.',
  })
  setResponseStatus(event, 201)
  return link
})
