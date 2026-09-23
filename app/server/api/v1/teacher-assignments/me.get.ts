/** GET /api/v1/teacher-assignments/me — self-service variant */
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listMyClasses } from '~/server/services/teachers-self'

const querySchema = z.object({ sessionId: uuidSchema.optional() })

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teachers.view')
  const query = parseQueryData(querySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'teachers.view')
  return listMyClasses(actor, { sessionId: query.sessionId })
})
