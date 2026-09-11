/**
 * PUT /api/v1/subjects/{id}
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, subjectUpdateSchema } from '~/shared/schemas'
import { updateSubject } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'subjects.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(subjectUpdateSchema, await readBody(event))
  const subject = await updateSubject(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'subject.update',
    resource: 'subject',
    resourceId: subject.id,
    description: `Updated subject ${subject.name}.`,
  })
  return subject
})
