/**
 * POST /api/v1/subjects
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { subjectCreateSchema } from '~/shared/schemas'
import { createSubject } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'subjects.manage')
  const data = parseBody(subjectCreateSchema, await readBody(event))
  const subject = await createSubject(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'subject.create',
    resource: 'subject',
    resourceId: subject.id,
    description: `Created subject ${subject.name}.`,
  })
  setResponseStatus(event, 201)
  return subject
})
