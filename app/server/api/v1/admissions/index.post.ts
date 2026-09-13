/** POST /api/v1/admissions */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { applicationCreateSchema } from '~/shared/schemas'
import { createApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.create')
  const data = parseBody(applicationCreateSchema, await readBody(event))
  const application = await createApplication(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.create',
    resource: 'admission_application',
    resourceId: application.id,
    description: `Created application ${application.applicationNumber} for ${application.firstName} ${application.lastName}.`,
  })
  setResponseStatus(event, 201)
  return application
})
