/** PUT /api/v1/exams/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { examUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateExam } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(examUpdateSchema, await readBody(event))
  const exam = await updateExam(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam.update',
    resource: 'exam',
    resourceId: exam.id,
    description: `Updated exam "${exam.name}".`,
  })
  return exam
})
