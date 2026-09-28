/** POST /api/v1/newsletter/subscribe — public newsletter subscription (Phase 17B). */
import {
  defineEventHandler,
  readBody,
  setResponseStatus,
  setResponseHeader,
  createError,
  getRequestIP,
} from 'h3'
import { parseBody } from '~/server/utils/validation'
import { newsletterSubscribeSchema } from '~/shared/schemas/notifications'
import { subscribeNewsletter } from '~/server/services/notifications'
import { checkRateLimit } from '~/server/utils/auth/throttle'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit(event, 'newsletter-subscribe', ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many subscription attempts. Please try again later.',
    })
  }

  const data = parseBody(newsletterSubscribeSchema, await readBody(event))
  const result = await subscribeNewsletter(data)
  setResponseStatus(event, 201)
  return result
})
