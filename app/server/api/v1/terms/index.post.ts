/**
 * POST /api/v1/terms
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { termCreateSchema } from '~/shared/schemas'
import { createTerm } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'terms.manage')
  const data = parseBody(termCreateSchema, await readBody(event))
  const term = await createTerm(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'term.create',
    resource: 'term',
    resourceId: term.id,
    description: `Created term ${term.name}.`,
  })
  setResponseStatus(event, 201)
  return term
})
