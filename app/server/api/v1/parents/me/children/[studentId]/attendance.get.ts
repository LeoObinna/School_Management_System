/** GET /api/v1/parents/me/children/:studentId/attendance?sessionId&termId? */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import {
  idParamSchema,
  studentAttendanceQuerySchema,
} from '~/shared/schemas'
import { getChildAttendance } from '~/server/services/parents-self'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const { id: studentId } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'studentId'),
  })
  const query = parseQueryData(studentAttendanceQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'attendance.approve')
  return getChildAttendance(studentId, query, actor)
})
