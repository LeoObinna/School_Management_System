/** DELETE /api/v1/parents/:id (deactivates the parent) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateParent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'parents.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const parent = await deactivateParent(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'parent.deactivate',
    resource: 'parent',
    resourceId: parent.id,
    description: `Deactivated parent ${parent.firstName} ${parent.lastName}.`,
  })
  return { message: 'Parent deactivated.' }
})
