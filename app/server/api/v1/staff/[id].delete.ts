/** DELETE /api/v1/staff/:id (deactivates the staff member) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateStaff } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'staff.delete')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const staff = await deactivateStaff(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'staff.deactivate',
    resource: 'staff',
    resourceId: staff.id,
    description: `Deactivated staff ${staff.staffNumber}.`,
  })
  return { message: 'Staff deactivated.' }
})
