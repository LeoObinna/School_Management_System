/** DELETE /api/v1/students/:id/parents/:parentId */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { z } from 'zod'
import { uuidSchema } from '~/shared/schemas'
import { removeStudentParent } from '~/server/services/people'
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
  await removeStudentParent(ids.id, ids.parentId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'student_parent.delete',
    resource: 'student_parent',
    resourceId: `${ids.id}:${ids.parentId}`,
    description: `Unlinked parent from student.`,
  })
  return { message: 'Parent link removed.' }
})
