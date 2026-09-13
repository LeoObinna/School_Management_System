/** POST /api/v1/report-cards/:id/publish */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  publishReportCard,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'report_cards.publish')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'report_cards.publish')
  const card = await publishReportCard(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'report_card.publish',
    resource: 'report_card',
    resourceId: card.id,
    description: `Published report card for ${card.studentName}.`,
  })
  return card
})
