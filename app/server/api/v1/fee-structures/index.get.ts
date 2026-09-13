/** GET /api/v1/fee-structures */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { feeStructureListQuerySchema } from '~/shared/schemas'
import { getFinanceActor, listFeeStructures } from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.view')
  const query = parseQueryData(
    feeStructureListQuerySchema,
    getQuery(event),
  )
  const actor = await getFinanceActor(auth)
  return listFeeStructures(query, actor)
})
