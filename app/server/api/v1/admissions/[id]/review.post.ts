/** POST /api/v1/admissions/:id/review */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationReviewSchema,
  idParamSchema,
} from '~/shared/schemas'
import { reviewApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.review')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationReviewSchema, await readBody(event))
  const application = await reviewApplication(id, data.notes, {
    userId: auth.user.id,
  })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.review',
    resource: 'admission_application',
    resourceId: id,
    description: `Marked application ${application.applicationNumber} under review.`,
  })
  return application
})
