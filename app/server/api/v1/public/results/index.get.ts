/**
 * GET /api/v1/public/results — public result checker (Phase 18D).
 *
 * Unauthenticated, rate limited (`public-result-check`, 10 / 10 min /
 * IP). Identity: admission number + surname + session + term. Answers
 * only published results with safe display fields; every mismatch is
 * the same generic 404. No cache headers — the check is interactive
 * and results change when staff publish.
 */
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestIP,
  setResponseHeader,
} from 'h3'
import { parseQueryData } from '~/server/utils/validation'
import { publicResultQuerySchema } from '~/shared/schemas'
import { getPublicResult } from '~/server/services/public-results'
import { checkRateLimit } from '~/server/utils/auth/throttle'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit(event, 'public-result-check', ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many result checks. Please try again later.',
    })
  }

  const query = parseQueryData(publicResultQuerySchema, getQuery(event))
  return getPublicResult(query)
})
