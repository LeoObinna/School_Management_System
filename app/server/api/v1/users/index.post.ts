/** POST /api/v1/users — create a login account (users.create). */
import {
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { userCreateSchema } from '~/shared/schemas'
import { createUser } from '~/server/services/users'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'users.create')
  const data = parseBody(userCreateSchema, await readBody(event))
  const user = await createUser(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'user.create',
    resource: 'user',
    resourceId: user.id,
    description: `Created user ${user.email}.`,
  })
  setResponseStatus(event, 201)
  return user
})
