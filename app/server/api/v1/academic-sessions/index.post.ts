/**
 * POST /api/v1/academic-sessions
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { academicSessionCreateSchema } from '~/shared/schemas'
import { createSession } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'academic_sessions.manage')
  const data = parseBody(academicSessionCreateSchema, await readBody(event))
  const session = await createSession(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'academic_session.create',
    resource: 'academic_session',
    resourceId: session.id,
    description: `Created academic session ${session.name}.`,
  })
  setResponseStatus(event, 201)
  return session
})
