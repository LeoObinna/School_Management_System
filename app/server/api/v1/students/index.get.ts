/** GET /api/v1/students */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { studentListQuerySchema } from '~/shared/schemas'
import { listStudents } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'students.view')
  const query = parseQueryData(studentListQuerySchema, getQuery(event))
  return listStudents(query)
})
