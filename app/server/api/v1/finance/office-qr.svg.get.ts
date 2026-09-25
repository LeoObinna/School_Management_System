/**
 * GET /api/v1/finance/office-qr.svg
 *
 * Static office QR encoding the school's bank details (from settings) —
 * parents scan it to confirm the transfer account before paying at the
 * bank/office. Requires `payments.view` (bank details are never public).
 * 404 when the school has not configured bank details.
 */
import { defineEventHandler, createError, setHeader } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getSchoolSettings } from '~/server/services/school-settings'
import { buildOfficeQrPayload } from '~/server/utils/qr/payload'
import { renderQrSvg } from '~/server/utils/qr/render'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'payments.view')
  const settings = await getSchoolSettings(event)
  const payload = buildOfficeQrPayload(settings)
  if (!payload) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'School bank details have not been configured.',
    })
  }
  const svg = await renderQrSvg(payload)
  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return svg
})
