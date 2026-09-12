/** GET /api/v1/attendance/report?sessionId&classId&termId?&sectionId? */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceReportQuerySchema } from '~/shared/schemas'
import { attendanceClassReport } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const query = parseQueryData(
    attendanceReportQuerySchema,
    getQuery(event),
  )
  const data = await attendanceClassReport(query)
  return { data }
})
