/** GET /api/v1/timetable/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getTimetableEntryOrThrow } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'timetable.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  return getTimetableEntryOrThrow(id)
})
