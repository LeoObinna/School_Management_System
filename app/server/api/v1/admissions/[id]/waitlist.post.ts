/** POST /api/v1/admissions/:id/waitlist */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationWaitlistSchema,
  idParamSchema,
} from '~/shared/schemas'
import { waitlistApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.review')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationWaitlistSchema, await readBody(event))
  const application = await waitlistApplication(id, data.decisionNotes)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.waitlist',
    resource: 'admission_application',
    resourceId: id,
    description: `Waitlisted application ${application.applicationNumber}.`,
  })
  return application
})
