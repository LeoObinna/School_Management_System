/** GET /api/v1/invoices */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { invoiceListQuerySchema } from '~/shared/schemas'
import { getFinanceActor, listInvoices } from '~/server/services/finance'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.view')
  const query = parseQueryData(invoiceListQuerySchema, getQuery(event))
  const actor = await getFinanceActor(auth)
  return listInvoices(query, actor)
})
