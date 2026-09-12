/** POST /api/v1/attendance/sessions/:id/submit */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { submitAttendanceSession } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const session = await submitAttendanceSession(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.submit',
    resource: 'attendance_session',
    resourceId: id,
    description: `Submitted attendance register ${session.date} for approval.`,
  })
  return session
})
