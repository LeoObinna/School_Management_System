/**
 * POST /api/v1/classes
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { classCreateSchema } from '~/shared/schemas'
import { createClass } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'classes.manage')
  const data = parseBody(classCreateSchema, await readBody(event))
  const klass = await createClass(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'class.create',
    resource: 'class',
    resourceId: klass.id,
    description: `Created class ${klass.name}.`,
  })
  setResponseStatus(event, 201)
  return klass
})
