/**
 * DELETE /api/v1/terms/{id} — deactivates the term (history preserved).
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateTerm } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'terms.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const term = await deactivateTerm(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'term.deactivate',
    resource: 'term',
    resourceId: term.id,
    description: `Deactivated term ${term.name}.`,
  })
  return term
})
