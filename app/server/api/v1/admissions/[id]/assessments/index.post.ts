/** POST /api/v1/admissions/:id/assessments */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  assessmentCreateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { addAssessment } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(assessmentCreateSchema, await readBody(event))
  const application = await addAssessment(id, data, {
    userId: auth.user.id,
  })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.assessment.create',
    resource: 'admission_application',
    resourceId: id,
    description: `Scheduled assessment "${data.title}" for application ${application.applicationNumber}.`,
  })
  setResponseStatus(event, 201)
  return application
})
