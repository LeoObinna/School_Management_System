/**
 * DELETE /api/v1/subjects/{id} — deactivates the subject (history kept).
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateSubject } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'subjects.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const subject = await deactivateSubject(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'subject.deactivate',
    resource: 'subject',
    resourceId: subject.id,
    description: `Deactivated subject ${subject.name}.`,
  })
  return subject
})
