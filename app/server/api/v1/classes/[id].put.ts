/**
 * PUT /api/v1/classes/{id}
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { classUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateClass } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'classes.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(classUpdateSchema, await readBody(event))
  const klass = await updateClass(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class.update',
    resource: 'class',
    resourceId: klass.id,
    description: `Updated class ${klass.name}.`,
  })
  return klass
})
