/** POST /api/v1/admissions/:id/withdraw */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationWaitlistSchema,
  idParamSchema,
} from '~/shared/schemas'
import { withdrawApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationWaitlistSchema, await readBody(event))
  const application = await withdrawApplication(id, data.decisionNotes)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.withdraw',
    resource: 'admission_application',
    resourceId: id,
    description: `Withdrew application ${application.applicationNumber}.`,
  })
  return application
})
