/** DELETE /api/v1/attendance/sessions/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { removeAttendanceSession } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  await removeAttendanceSession(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.session_delete',
    resource: 'attendance_session',
    resourceId: id,
    description: 'Deleted an open attendance register.',
  })
  return { message: 'Attendance register removed.' }
})
