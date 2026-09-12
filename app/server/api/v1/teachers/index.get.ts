/** GET /api/v1/teachers */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { teacherListQuerySchema } from '~/shared/schemas'
import { listTeachers } from '~/server/services/people'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teachers.view')
  const query = parseQueryData(teacherListQuerySchema, getQuery(event))
  return listTeachers(query)
})
