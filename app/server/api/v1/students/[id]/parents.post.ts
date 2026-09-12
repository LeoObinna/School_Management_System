/** POST /api/v1/students/:id/parents */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, studentParentBodySchema } from '~/shared/schemas'
import { addStudentParent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'parents.link_children')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(studentParentBodySchema, await readBody(event))
  const link = await addStudentParent(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student_parent.create',
    resource: 'student_parent',
    resourceId: `${id}:${link.parentId}`,
    description: `Linked parent to student ${id}.`,
  })
  setResponseStatus(event, 201)
  return link
})
