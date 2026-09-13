/** POST /api/v1/students/:id/report-cards */
import {
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  idParamSchema,
  reportCardGenerateSchema,
} from '~/shared/schemas'
import {
  generateReportCard,
  getActor,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'report_cards.generate')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(
    reportCardGenerateSchema,
    await readBody(event),
  )
  const actor = await getActor(auth, 'report_cards.generate')
  // Force the report card to the path student id.
  const card = await generateReportCard(
    { ...data, studentId: id },
    actor,
  )
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'report_card.generate',
    resource: 'report_card',
    resourceId: card.id,
    description: `Generated report card for ${card.studentName} (${card.termName}).`,
  })
  setResponseStatus(event, 201)
  return card
})
