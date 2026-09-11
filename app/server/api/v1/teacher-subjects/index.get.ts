/**
 * GET /api/v1/teacher-subjects?teacherId=...
 * Subjects a teacher is able to teach.
 */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { teacherSubjectListQuerySchema } from '~/shared/schemas'
import { listTeacherSubjects } from '~/server/services/teacher-academics'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teacher_assignments.manage')
  const { teacherId } = parseQueryData(
    teacherSubjectListQuerySchema,
    getQuery(event),
  )
  return { data: await listTeacherSubjects(teacherId) }
})
