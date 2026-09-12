/** PUT /api/v1/students/:id/parents/:parentId */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { studentParentUpdateSchema, uuidSchema } from '~/shared/schemas'
import { z } from 'zod'
import { updateStudentParent } from '~/server/services/people'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'parents.link_children')
  const ids = parseInput(
    z.object({ id: uuidSchema, parentId: uuidSchema }),
    {
      id: getRouterParam(event, 'id'),
      parentId: getRouterParam(event, 'parentId'),
    },
  )
  const data = parseBody(studentParentUpdateSchema, await readBody(event))
  const link = await updateStudentParent(ids.id, ids.parentId, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student_parent.update',
    resource: 'student_parent',
    resourceId: `${ids.id}:${ids.parentId}`,
    description: `Updated student-parent link.`,
  })
  return link
})
