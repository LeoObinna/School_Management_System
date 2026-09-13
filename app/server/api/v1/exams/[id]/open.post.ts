/** POST /api/v1/exams/:id/open */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { setExamStatus } from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exams.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const exam = await setExamStatus(id, 'open')
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'exam.open',
    resource: 'exam',
    resourceId: exam.id,
    description: `Opened exam "${exam.name}" for score entry.`,
  })
  return exam
})
