/** PUT /api/v1/users/:id/roles — replace the user's role set (users.update). */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, userRolesUpdateSchema } from '~/shared/schemas'
import { setUserRoles } from '~/server/services/users'
import { writeAudit } from '~/server/utils/audit'
import { revokeAllSessions } from '~/server/utils/auth/revocation'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'users.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(userRolesUpdateSchema, await readBody(event))
  const user = await setUserRoles(id, data)
  // Role change may add/remove permissions; force re-authentication so
  // the next request carries the new grant set in its session.
  await revokeAllSessions(event, id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'user.roles.update',
    resource: 'user',
    resourceId: user.id,
    description: `Updated roles for ${user.email}: ${user.roles.join(', ') || '(none)'}.`,
    metadata: { roleIds: data.roleIds },
  })
  return user
})
