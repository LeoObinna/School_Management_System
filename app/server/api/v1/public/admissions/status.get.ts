/**
 * GET /api/v1/public/admissions/status — public application status check
 * (Phase 18C).
 *
 * Unauthenticated, rate limited (`public-admission-status`, 20 / 10 min).
 * Exact match on application number + guardian email or phone; every
 * mismatch is the same generic 404 so application numbers cannot be
 * enumerated. The response is the status label only — no applicant data.
 * No cache headers: statuses change as staff process the application.
 */
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestIP,
  setResponseHeader,
} from 'h3'
import { parseQueryData } from '~/server/utils/validation'
import { admissionStatusQuerySchema } from '~/shared/schemas'
import { getPublicApplicationStatus } from '~/server/services/admissions'
import { checkRateLimit } from '~/server/utils/auth/throttle'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit(event, 'public-admission-status', ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many status checks. Please try again later.',
    })
  }

  const query = parseQueryData(admissionStatusQuerySchema, getQuery(event))
  return getPublicApplicationStatus(query)
})
