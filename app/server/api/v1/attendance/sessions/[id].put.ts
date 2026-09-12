/** PUT /api/v1/attendance/sessions/:id — update register metadata. */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  attendanceSessionUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateAttendanceSession } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(
    attendanceSessionUpdateSchema,
    await readBody(event),
  )
  const session = await updateAttendanceSession(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.session_update',
    resource: 'attendance_session',
    resourceId: session.id,
    description: `Updated attendance register ${session.date}.`,
  })
  return session
})
