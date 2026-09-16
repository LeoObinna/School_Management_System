/** GET /api/v1/attendance/students/:id?sessionId&termId? */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import {
  idParamSchema,
  studentAttendanceQuerySchema,
} from '~/shared/schemas'
import { studentAttendance } from '~/server/services/schedule'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'attendance.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const query = parseQueryData(
    studentAttendanceQuerySchema,
    getQuery(event),
  )
  // `attendance.approve` is admin-only; non-staff callers may only view
  // their own / their children's / their-class students' attendance
  // (Phase 12, else 403).
  const actor = await resolveActorProfile(event, 'attendance.approve')
  return studentAttendance(id, query, actor)
})
