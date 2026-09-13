/** POST /api/v1/admissions/:id/enroll */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  applicationEnrollSchema,
  idParamSchema,
} from '~/shared/schemas'
import { enrollApplication } from '~/server/services/admissions'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.approve')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(applicationEnrollSchema, await readBody(event))
  const result = await enrollApplication(id, data, {
    userId: auth.user.id,
  })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.application.enroll',
    resource: 'admission_application',
    resourceId: id,
    description: `Enrolled application ${result.application.applicationNumber} as student ${result.student.admissionNumber}.`,
  })
  setResponseStatus(event, 201)
  return result
})
