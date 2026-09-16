/** GET /api/v1/timetable */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseQueryData } from '~/server/utils/validation'
import { timetableListQuerySchema } from '~/shared/schemas'
import { listTimetableEntries } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'timetable.view')
  const query = parseQueryData(timetableListQuerySchema, getQuery(event))
  // `timetable.manage` is admin-only; teachers are scoped to their own
  // entries, students/parents to their enrolled classes (Phase 12).
  const actor = await resolveActorProfile(event, 'timetable.manage')
  return listTimetableEntries(query, actor)
})
