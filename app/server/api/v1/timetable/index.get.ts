/** GET /api/v1/timetable */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { timetableListQuerySchema } from '~/shared/schemas'
import { listTimetableEntries } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'timetable.view')
  const query = parseQueryData(timetableListQuerySchema, getQuery(event))
  return listTimetableEntries(query)
})
