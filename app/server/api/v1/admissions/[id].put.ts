/** PUT /api/v1/admissions/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationUpdateSchema, await readBody(event))
  const application = await updateApplication(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.update',
    resource: 'admission_application',
    resourceId: id,
    description: `Updated application ${application.applicationNumber}.`,
  })
  return application
})
