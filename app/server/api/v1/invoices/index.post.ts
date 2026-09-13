/** POST /api/v1/invoices */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { invoiceCreateSchema } from '~/shared/schemas'
import {
  createInvoice,
  getFinanceActor,
} from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'invoices.create')
  const data = parseBody(invoiceCreateSchema, await readBody(event))
  const actor = await getFinanceActor(auth)
  const invoice = await createInvoice(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'invoice.create',
    resource: 'invoice',
    resourceId: invoice.id,
    description: `Created invoice ${invoice.invoiceNumber} for ${invoice.studentName}.`,
  })
  setResponseStatus(event, 201)
  return invoice
})
