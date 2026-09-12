/** PUT /api/v1/parents/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, parentUpdateSchema } from '~/shared/schemas'
import { updateParent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'parents.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(parentUpdateSchema, await readBody(event))
  const parent = await updateParent(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'parent.update',
    resource: 'parent',
    resourceId: parent.id,
    description: `Updated parent ${parent.firstName} ${parent.lastName}.`,
  })
  return parent
})
