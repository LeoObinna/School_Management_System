/**
 * DELETE /api/v1/academic-sessions/{id}
 *
 * Deactivates the session (history-preserving). Academic history is
 * never physically deleted (README §2/§13).
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateSession } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'academic_sessions.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const session = await deactivateSession(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'academic_session.deactivate',
    resource: 'academic_session',
    resourceId: session.id,
    description: `Deactivated academic session ${session.name}.`,
  })
  return session
})
