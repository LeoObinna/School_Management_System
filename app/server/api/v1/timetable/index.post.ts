/** POST /api/v1/timetable */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { timetableCreateSchema } from '~/shared/schemas'
import { createTimetableEntry } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'timetable.manage')
  const data = parseBody(timetableCreateSchema, await readBody(event))
  const entry = await createTimetableEntry(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'timetable.create',
    resource: 'timetable_entry',
    resourceId: entry.id,
    description: `Added ${entry.subjectName} for ${entry.className} on ${entry.weekday} ${entry.startTime.slice(0, 5)}.`,
  })
  setResponseStatus(event, 201)
  return entry
})
