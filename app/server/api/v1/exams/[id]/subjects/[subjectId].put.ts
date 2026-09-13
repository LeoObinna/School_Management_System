/** PUT /api/v1/exams/:id/subjects/:subjectId */
import {
  defineEventHandler,
  getRouterParam,
  readBody,
} from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  examSubjectUpsertSchema,
  uuidSchema,
} from '~/shared/schemas'
import { updateExamSubject } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({
  id: uuidSchema,
  subjectId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id, subjectId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    subjectId: getRouterParam(event, 'subjectId'),
  })
  const data = parseBody(examSubjectUpsertSchema, await readBody(event))
  const exam = await updateExamSubject(id, subjectId, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam_subject.update',
    resource: 'exam_subject',
    resourceId: subjectId,
    description: `Updated subject ${subjectId} on exam "${exam.name}".`,
  })
  return exam
})
