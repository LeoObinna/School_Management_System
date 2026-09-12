/** GET /api/v1/attendance/sessions */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceSessionListQuerySchema } from '~/shared/schemas'
import { listAttendanceSessions } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const query = parseQueryData(
    attendanceSessionListQuerySchema,
    getQuery(event),
  )
  return listAttendanceSessions(query)
})
