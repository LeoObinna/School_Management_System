/** GET /api/v1/teachers/me/students — roster across assigned classes */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { myStudentListQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listMyStudents } from '~/server/services/teachers-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const query = parseQueryData(myStudentListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'students.view')
  return listMyStudents(query, actor)
})
