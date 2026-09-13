/** PUT /api/v1/admissions/:id/assessments/:assessmentId */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  assessmentUpdateSchema,
  uuidSchema,
} from '~/shared/schemas'
import { updateAssessment } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, assessmentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.update')
  const { id, assessmentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    assessmentId: getRouterParam(event, 'assessmentId'),
  })
  const data = parseBody(assessmentUpdateSchema, await readBody(event))
  const application = await updateAssessment(id, assessmentId, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.assessment.update',
    resource: 'admission_assessment',
    resourceId: assessmentId,
    description: `Updated assessment ${assessmentId} on application ${application.applicationNumber}.`,
  })
  return application
})
