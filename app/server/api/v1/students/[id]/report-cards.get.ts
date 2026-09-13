/** GET /api/v1/students/:id/report-cards */
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import {
  idParamSchema,
  reportCardListQuerySchema,
} from '~/shared/schemas'
import {
  getActor,
  listReportCards,
} from '~/server/services/exams'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'report_cards.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const query = parseQueryData(
    reportCardListQuerySchema,
    getQuery(event),
  )
  const actor = await getActor(auth, 'report_cards.view')
  // Restrict the list to the path student id.
  return listReportCards({ ...query, studentId: id }, actor)
})
