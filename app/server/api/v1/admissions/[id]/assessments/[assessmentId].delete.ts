/** DELETE /api/v1/admissions/:id/assessments/:assessmentId */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { deleteAssessment } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, assessmentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.update')
  const { id, assessmentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    assessmentId: getRouterParam(event, 'assessmentId'),
  })
  const application = await deleteAssessment(id, assessmentId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.assessment.delete',
    resource: 'admission_assessment',
    resourceId: assessmentId,
    description: `Deleted assessment ${assessmentId} from application ${application.applicationNumber}.`,
  })
  return application
})
