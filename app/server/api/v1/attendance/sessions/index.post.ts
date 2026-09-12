/** POST /api/v1/attendance/sessions */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { attendanceSessionCreateSchema } from '~/shared/schemas'
import { createAttendanceSession } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.mark')
  const data = parseBody(
    attendanceSessionCreateSchema,
    await readBody(event),
  )
  const session = await createAttendanceSession(data, auth.user.id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.session_create',
    resource: 'attendance_session',
    resourceId: session.id,
    description: `Opened attendance register for ${session.className} on ${session.date}.`,
  })
  setResponseStatus(event, 201)
  return session
})
