/** PUT /api/v1/attendance/sessions/:id/records — bulk mark/upsert. */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  attendanceMarkBodySchema,
  idParamSchema,
} from '~/shared/schemas'
import { markAttendance } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'attendance.mark')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(attendanceMarkBodySchema, await readBody(event))
  const session = await markAttendance(id, data, auth.user.id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'attendance.mark',
    resource: 'attendance_session',
    resourceId: id,
    description: `Marked ${data.records.length} student(s) for ${session.className} on ${session.date}.`,
  })
  return session
})
