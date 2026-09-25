/**
 * GET /api/v1/payments/paystack/config
 *
 * Reports whether online checkout is available (a Paystack secret key
 * is configured). Any authenticated user may read this; the billing UI
 * hides the Pay Online flow when disabled.
 */
import { defineEventHandler } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { isPaystackConfigured } from '~/server/services/paystack'
import type { PaystackConfigStatus } from '~/shared/types'

export default defineEventHandler(async (event): Promise<PaystackConfigStatus> => {
  requireUser(event)
  return { enabled: isPaystackConfigured(event) }
})
