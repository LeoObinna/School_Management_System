/**
 * POST /api/v1/public/contact — public contact form (Phase 18C).
 *
 * Unauthenticated: honeypot (`_website` must be empty) + KV sliding-window
 * IP rate limit (`public-contact`, 3 / 10 min). A tripped honeypot returns
 * the same 201 acknowledgement as a real submission so bots cannot
 * distinguish rejection from success. The response never echoes the
 * stored message.
 */
import {
  createError,
  defineEventHandler,
  getRequestIP,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { parseBody } from '~/server/utils/validation'
import { contactMessageCreateSchema } from '~/shared/schemas'
import { createContactMessage } from '~/server/services/contact-messages'
import { checkRateLimit } from '~/server/utils/auth/throttle'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit(event, 'public-contact', ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many messages. Please try again later.',
    })
  }

  const data = parseBody(contactMessageCreateSchema, await readBody(event))

  // Honeypot filled: pretend success, persist nothing.
  if (data._website) {
    setResponseStatus(event, 201)
    return { received: true as const }
  }

  await createContactMessage(data)
  setResponseStatus(event, 201)
  return { received: true as const }
})
