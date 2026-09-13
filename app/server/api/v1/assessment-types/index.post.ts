/** POST /api/v1/assessment-types */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { assessmentTypeCreateSchema } from '~/shared/schemas'
import { createAssessmentType } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.create')
  const data = parseBody(
    assessmentTypeCreateSchema,
    await readBody(event),
  )
  const assessmentType = await createAssessmentType(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assessment_type.create',
    resource: 'assessment_type',
    resourceId: assessmentType.id,
    description: `Created assessment type "${assessmentType.name}".`,
  })
  setResponseStatus(event, 201)
  return assessmentType
})
