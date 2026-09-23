/** POST /api/v1/assignments/:id/submissions/:studentId/grade */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  submissionGradeSchema,
  uuidSchema,
} from '~/shared/schemas'
import { gradeSubmission } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, studentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'submissions.grade')
  const { id, studentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    studentId: getRouterParam(event, 'studentId'),
  })
  const data = parseBody(submissionGradeSchema, await readBody(event))
  const actor = await resolveActorProfile(event, 'assignments.create')
  const submission = await gradeSubmission(id, studentId, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'submission.grade',
    resource: 'assignment_submission',
    resourceId: submission.id as string,
    description: `Graded submission for student ${studentId} on assignment ${id} with ${data.score}.`,
  })
  return submission
})
