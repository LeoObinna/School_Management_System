/** POST /api/v1/invoices/{id}/issue */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getFinanceActor,
  issueInvoice,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  const invoice = await issueInvoice(id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'invoice.issue',
    resource: 'invoice',
    resourceId: invoice.id,
    description: `Issued invoice ${invoice.invoiceNumber}.`,
  })
  return invoice
})
