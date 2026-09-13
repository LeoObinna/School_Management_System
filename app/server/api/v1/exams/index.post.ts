/** POST /api/v1/exams */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { examCreateSchema } from '~/shared/schemas'
import { createExam } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.create')
  const data = parseBody(examCreateSchema, await readBody(event))
  const exam = await createExam(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam.create',
    resource: 'exam',
    resourceId: exam.id,
    description: `Created exam "${exam.name}" for ${exam.className}.`,
  })
  setResponseStatus(event, 201)
  return exam
})
