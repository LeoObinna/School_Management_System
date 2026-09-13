/** GET /api/v1/finance/summary */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { financeSummaryQuerySchema } from '~/shared/schemas'
import {
  financeSummary,
  getFinanceActor,
} from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(
    financeSummaryQuerySchema,
    getQuery(event),
  )
  const actor = await getFinanceActor(auth)
  return financeSummary(query, actor)
})
