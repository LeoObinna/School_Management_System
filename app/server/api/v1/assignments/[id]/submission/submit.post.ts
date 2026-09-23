/** POST /api/v1/assignments/:id/submission/submit */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { submitMySubmission } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'submissions.create')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  const submission = await submitMySubmission(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'submission.submit',
    resource: 'assignment_submission',
    resourceId: submission.id as string,
    description: `Submitted work for assignment ${id} (${submission.status}).`,
  })
  return submission
})
