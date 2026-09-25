/**
 * GET /api/v1/finance/bank-details
 *
 * Bank-transfer details for the billing page's "pay by bank transfer"
 * card (shown when Paystack is not configured, and as an alternative
 * when it is). Requires `payments.view` — bank details stay off the
 * public settings surface.
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getSchoolSettings } from '~/server/services/school-settings'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'payments.view')
  const settings = await getSchoolSettings(event)
  return {
    bankName: settings.bankName,
    accountName: settings.accountName ?? settings.name,
    accountNumber: settings.accountNumber,
  }
})
