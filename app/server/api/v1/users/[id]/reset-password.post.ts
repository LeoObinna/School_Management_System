/** POST /api/v1/users/:id/reset-password — admin reset (users.update). */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { adminResetPasswordSchema, idParamSchema } from '~/shared/schemas'
import { adminResetPassword } from '~/server/services/users'
import { writeAudit } from '~/server/utils/audit'
import { revokeAllSessions } from '~/server/utils/auth/revocation'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'users.update')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const { newPassword } = parseBody(
    adminResetPasswordSchema,
    await readBody(event),
  )
  await adminResetPassword(id, newPassword)
  // Invalidate every existing session for the user.
  await revokeAllSessions(event, id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'user.password.reset',
    resource: 'user',
    resourceId: id,
    description: `Admin reset password for user ${id}.`,
  })
  return { message: 'Password reset.' }
})
