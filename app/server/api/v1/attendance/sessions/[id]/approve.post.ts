/** POST /api/v1/attendance/sessions/:id/approve */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { approveAttendanceSession } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.approve')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const session = await approveAttendanceSession(id, auth.user.id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.approve',
    resource: 'attendance_session',
    resourceId: id,
    description: `Approved attendance register ${session.date}.`,
  })
  return session
})
