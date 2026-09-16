/** GET /api/v1/attendance/report?sessionId&classId&termId?&sectionId? */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceReportQuerySchema } from '~/shared/schemas'
import { attendanceClassReport } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const query = parseQueryData(
    attendanceReportQuerySchema,
    getQuery(event),
  )
  // `attendance.approve` is admin-only; non-staff callers must teach or
  // be enrolled in the requested class (Phase 12, else 403).
  const actor = await resolveActorProfile(event, 'attendance.approve')
  const data = await attendanceClassReport(query, actor)
  return { data }
})
