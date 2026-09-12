/** PUT /api/v1/timetable/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, timetableUpdateSchema } from '~/shared/schemas'
import { updateTimetableEntry } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'timetable.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(timetableUpdateSchema, await readBody(event))
  const entry = await updateTimetableEntry(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'timetable.update',
    resource: 'timetable_entry',
    resourceId: entry.id,
    description: `Updated timetable entry for ${entry.className} (${entry.subjectName}).`,
  })
  return entry
})
