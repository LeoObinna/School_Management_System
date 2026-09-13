/** POST /api/v1/admissions/:id/approve */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationDecisionSchema,
  idParamSchema,
} from '~/shared/schemas'
import { decideApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.approve')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationDecisionSchema, await readBody(event))
  const application = await decideApplication(
    id,
    'accepted',
    data.decisionNotes,
    { userId: auth.user.id },
  )
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.approve',
    resource: 'admission_application',
    resourceId: id,
    description: `Accepted application ${application.applicationNumber}.`,
  })
  return application
})
