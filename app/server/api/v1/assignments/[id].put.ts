/** PUT /api/v1/assignments/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  assignmentUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { getActor, updateAssignment } from '~/server/services/assignments'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(assignmentUpdateSchema, await readBody(event))
  const actor = await getActor(auth)
  const assignment = await updateAssignment(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assignment.update',
    resource: 'assignment',
    resourceId: id,
    description: `Updated assignment "${assignment.title}".`,
  })
  return assignment
})
