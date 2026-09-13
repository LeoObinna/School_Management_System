/** POST /api/v1/exams/:id/subjects */
import {
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  examSubjectUpsertSchema,
  idParamSchema,
} from '~/shared/schemas'
import { addExamSubject } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(examSubjectUpsertSchema, await readBody(event))
  const exam = await addExamSubject(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam_subject.add',
    resource: 'exam_subject',
    resourceId: data.subjectId,
    description: `Added subject ${data.subjectId} to exam "${exam.name}".`,
  })
  setResponseStatus(event, 201)
  return exam
})
