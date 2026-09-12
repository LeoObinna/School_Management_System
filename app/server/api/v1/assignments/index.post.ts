/** POST /api/v1/assignments */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { assignmentCreateSchema } from '~/shared/schemas'
import { createAssignment, getActor } from '~/server/services/assignments'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.create')
  const data = parseBody(assignmentCreateSchema, await readBody(event))
  const actor = await getActor(auth)
  const assignment = await createAssignment(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assignment.create',
    resource: 'assignment',
    resourceId: assignment.id,
    description: `Created assignment "${assignment.title}" for ${assignment.className}.`,
  })
  setResponseStatus(event, 201)
  return assignment
})
