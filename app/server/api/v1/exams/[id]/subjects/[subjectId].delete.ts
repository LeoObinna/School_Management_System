/** DELETE /api/v1/exams/:id/subjects/:subjectId */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { removeExamSubject } from '~/server/services/exams'
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
  await removeExamSubject(id, subjectId)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam_subject.remove',
    resource: 'exam_subject',
    resourceId: subjectId,
    description: `Removed subject ${subjectId} from exam ${id}.`,
  })
  return { ok: true }
})
