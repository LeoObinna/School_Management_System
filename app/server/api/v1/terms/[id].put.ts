/**
 * PUT /api/v1/terms/{id}
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, termUpdateSchema } from '~/shared/schemas'
import { updateTerm } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'terms.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(termUpdateSchema, await readBody(event))
  const term = await updateTerm(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'term.update',
    resource: 'term',
    resourceId: term.id,
    description: `Updated term ${term.name}.`,
  })
  return term
})
