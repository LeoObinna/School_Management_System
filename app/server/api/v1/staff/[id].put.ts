/** PUT /api/v1/staff/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, staffUpdateSchema } from '~/shared/schemas'
import { updateStaff } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'staff.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(staffUpdateSchema, await readBody(event))
  const staff = await updateStaff(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'staff.update',
    resource: 'staff',
    resourceId: staff.id,
    description: `Updated staff ${staff.staffNumber}.`,
  })
  return staff
})
