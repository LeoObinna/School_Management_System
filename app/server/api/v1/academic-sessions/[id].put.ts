/**
 * PUT /api/v1/academic-sessions/{id}
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  academicSessionUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateSession } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'academic_sessions.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(academicSessionUpdateSchema, await readBody(event))
  const session = await updateSession(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'academic_session.update',
    resource: 'academic_session',
    resourceId: session.id,
    description: `Updated academic session ${session.name}.`,
  })
  return session
})
