/** DELETE /api/v1/users/:id — soft-delete (deactivate) (users.delete). */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { softDeleteUser } from '~/server/services/users'
import { writeAudit } from '~/server/utils/audit'
import { revokeAllSessions } from '~/server/utils/auth/revocation'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'users.delete')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  await softDeleteUser(id)
  // Kill all outstanding sessions for the deactivated user.
  await revokeAllSessions(event, id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'user.delete',
    resource: 'user',
    resourceId: id,
    description: `Deactivated user ${id}.`,
  })
  return { message: 'User deactivated.' }
})
