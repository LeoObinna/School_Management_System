/**
 * GET /api/v1/payments/{id}/receipt/download
 *
 * Streams the branded receipt PDF. Lazily generates it into R2 on first
 * download (receipts created before Phase 15 have no stored PDF).
 * Parent/child visibility is enforced inside the service.
 */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getFinanceActor } from '~/server/services/finance'
import { ensureReceiptPdf } from '~/server/services/receipts'
import { streamObject } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'receipts.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  const { objectKey, receiptNumber } = await ensureReceiptPdf(event, id, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'receipt.download',
    resource: 'payment_receipt',
    resourceId: id,
    description: `Downloaded receipt ${receiptNumber}.`,
  })
  return streamObject(
    event,
    objectKey,
    `receipt-${receiptNumber}.pdf`,
    'application/pdf',
    { disposition: 'attachment' },
  )
})
