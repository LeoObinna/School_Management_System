/**
 * GET /api/v1/invoices/{id}/qr.svg
 *
 * Per-invoice dynamic QR: the school's bank details plus the invoice
 * number as the transfer reference and the current balance as the
 * amount due. Parent/child visibility is enforced via getInvoice (404
 * for out-of-scope callers). 404 when bank details are not configured.
 */
import { defineEventHandler, createError, getRouterParam, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getFinanceActor, getInvoice } from '~/server/services/finance'
import { getSchoolSettings } from '~/server/services/school-settings'
import { buildInvoiceQrPayload } from '~/server/utils/qr/payload'
import { renderQrSvg } from '~/server/utils/qr/render'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'payments.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getFinanceActor(auth)
  const invoice = await getInvoice(id, actor)
  const settings = await getSchoolSettings(event)
  const payload = buildInvoiceQrPayload(settings, {
    invoiceNumber: invoice.invoiceNumber,
    balance: invoice.balance,
  })
  if (!payload) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'School bank details have not been configured.',
    })
  }
  // Balance is dynamic — never cache.
  const svg = await renderQrSvg(payload)
  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return svg
})
