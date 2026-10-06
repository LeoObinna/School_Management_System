/**
 * POST /api/v1/public/admissions/applications — public application form
 * (Phase 18C).
 *
 * Unauthenticated: honeypot (`_website` must be empty) + KV sliding-window
 * IP rate limit (`public-admission`, 5 / hour). A tripped honeypot returns
 * a plausible-but-fake 201 so bots cannot tell they failed; nothing is
 * persisted. Real submissions reuse the staff `createApplication` core
 * (auto-numbered APP-YYYY-NNNN, status `applied`) with the session pinned
 * to the current academic session. The response carries only the
 * application number — never applicant data.
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
import { publicApplicationSchema } from '~/shared/schemas'
import { createPublicApplication } from '~/server/services/admissions'
import { checkRateLimit } from '~/server/utils/auth/throttle'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit(event, 'public-admission', ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message:
        'Too many application attempts. Please try again later or contact the school office.',
    })
  }

  const data = parseBody(publicApplicationSchema, await readBody(event))

  // Honeypot filled: pretend success, persist nothing.
  if (data._website) {
    setResponseStatus(event, 201)
    const year = new Date().getFullYear()
    const fake = Math.floor(1000 + Math.random() * 9000)
    return { applicationNumber: `APP-${year}-${fake}` }
  }

  const applicationNumber = await createPublicApplication(data)
  setResponseStatus(event, 201)
  return { applicationNumber }
})
