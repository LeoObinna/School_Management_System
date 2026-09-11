/**
 * DELETE /api/v1/classes/{id} — deactivates the class (history preserved).
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateClass } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'classes.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const klass = await deactivateClass(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class.deactivate',
    resource: 'class',
    resourceId: klass.id,
    description: `Deactivated class ${klass.name}.`,
  })
  return klass
})
