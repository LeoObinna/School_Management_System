/** PUT /api/v1/invoices/{id} */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, invoiceUpdateSchema } from '~/shared/schemas'
import {
  getFinanceActor,
  updateInvoice,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(invoiceUpdateSchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const invoice = await updateInvoice(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'invoice.update',
    resource: 'invoice',
    resourceId: invoice.id,
    description: `Updated draft invoice ${invoice.invoiceNumber}.`,
  })
  return invoice
})
