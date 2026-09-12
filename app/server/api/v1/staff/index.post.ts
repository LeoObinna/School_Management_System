/** POST /api/v1/staff */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { staffCreateSchema } from '~/shared/schemas'
import { createStaff } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'staff.create')
  const data = parseBody(staffCreateSchema, await readBody(event))
  const staff = await createStaff(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'staff.create',
    resource: 'staff',
    resourceId: staff.id,
    description: `Created staff ${staff.staffNumber}.`,
  })
  setResponseStatus(event, 201)
  return staff
})
