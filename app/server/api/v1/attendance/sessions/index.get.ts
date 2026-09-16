/** GET /api/v1/attendance/sessions */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseQueryData } from '~/server/utils/validation'
import { attendanceSessionListQuerySchema } from '~/shared/schemas'
import { listAttendanceSessions } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const query = parseQueryData(
    attendanceSessionListQuerySchema,
    getQuery(event),
  )
  // `attendance.approve` is admin-only; teachers are scoped to classes
  // they teach, students/parents to their enrolled classes (Phase 12).
  const actor = await resolveActorProfile(event, 'attendance.approve')
  return listAttendanceSessions(query, actor)
})
