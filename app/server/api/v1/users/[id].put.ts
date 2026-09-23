/** PUT /api/v1/users/:id — update profile / password (users.update). */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, userUpdateSchema } from '~/shared/schemas'
import { updateUser } from '~/server/services/users'
import { writeAudit } from '~/server/utils/audit'
import { revokeAllSessions } from '~/server/utils/auth/revocation'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'users.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(userUpdateSchema, await readBody(event))
  const user = await updateUser(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'user.update',
    resource: 'user',
    resourceId: user.id,
    description: `Updated user ${user.email}.`,
  })
  // If the password was changed, revoke all existing sessions so the
  // user must re-authenticate, and emit a separate audit entry.
  if (data.password) {
    await revokeAllSessions(event, id)
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'user.password.reset',
      resource: 'user',
      resourceId: user.id,
      description: `Admin reset password for ${user.email}.`,
    })
  }
  return user
})
