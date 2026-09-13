/** PUT /api/v1/assessment-types/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  assessmentTypeUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import {
  updateAssessmentType,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(
    assessmentTypeUpdateSchema,
    await readBody(event),
  )
  const assessmentType = await updateAssessmentType(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assessment_type.update',
    resource: 'assessment_type',
    resourceId: assessmentType.id,
    description: `Updated assessment type "${assessmentType.name}".`,
  })
  return assessmentType
})
