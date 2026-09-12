/** POST /api/v1/parents */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { parentCreateSchema } from '~/shared/schemas'
import { createParent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'parents.create')
  const data = parseBody(parentCreateSchema, await readBody(event))
  const parent = await createParent(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'parent.create',
    resource: 'parent',
    resourceId: parent.id,
    description: `Created parent ${parent.firstName} ${parent.lastName}.`,
  })
  setResponseStatus(event, 201)
  return parent
})
