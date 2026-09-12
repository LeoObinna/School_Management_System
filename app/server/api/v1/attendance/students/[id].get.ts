/** GET /api/v1/attendance/students/:id?sessionId&termId? */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
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
  return studentAttendance(id, query)
})
