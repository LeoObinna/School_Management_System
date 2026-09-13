/** GET /api/v1/my/school-context — current user's student id or children */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getMySchoolContext } from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.view')
  return getMySchoolContext(auth)
})
