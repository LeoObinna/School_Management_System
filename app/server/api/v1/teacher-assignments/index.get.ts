/**
 * GET /api/v1/teacher-assignments
 * Filters: teacherId, classId, sectionId, subjectId, sessionId.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { teacherAssignmentListQuerySchema } from '~/shared/schemas'
import { listAssignments } from '~/server/services/teacher-academics'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teacher_assignments.manage')
  const filters = parseQueryData(
    teacherAssignmentListQuerySchema,
    getQuery(event),
  )
  return { data: await listAssignments(filters) }
})
