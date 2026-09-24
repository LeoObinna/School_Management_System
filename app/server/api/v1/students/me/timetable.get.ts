/** GET /api/v1/students/me/timetable — weekly view for the calling student */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { myTimetableQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listMyTimetable } from '~/server/services/students-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'timetable.view')
  const query = parseQueryData(myTimetableQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'timetable.view')
  return listMyTimetable(query, actor)
})
