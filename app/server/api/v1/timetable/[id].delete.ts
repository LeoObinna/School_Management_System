/** DELETE /api/v1/timetable/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { removeTimetableEntry } from '~/server/services/schedule'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'timetable.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  await removeTimetableEntry(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'timetable.delete',
    resource: 'timetable_entry',
    resourceId: id,
    description: 'Removed a timetable entry.',
  })
  return { message: 'Timetable entry removed.' }
})
