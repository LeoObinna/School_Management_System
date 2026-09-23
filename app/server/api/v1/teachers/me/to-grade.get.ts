/** GET /api/v1/teachers/me/to-grade — assignments with pending submissions */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { submissionsToGradeQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listSubmissionsToGrade } from '~/server/services/teachers-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'submissions.view')
  const query = parseQueryData(submissionsToGradeQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'submissions.view')
  return listSubmissionsToGrade(query, actor)
})
