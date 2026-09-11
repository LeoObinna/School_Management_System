/**
 * POST /api/v1/auth/login
 *
 * Validates credentials, applies a best-effort throttle, sets the signed
 * HTTP-only session cookie and returns the user with roles/permissions
 * and a CSRF token. The same generic error is returned for unknown email
 * and wrong password to avoid account enumeration.
 */
import {
  defineEventHandler,
  createError,
  getRequestIP,
  setResponseHeader,
  readBody,
} from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { users } from '~/database/schema'
import { loginSchema } from '~/shared/schemas'
import { verifyPassword } from '~/server/utils/auth/password'
import { issueSession } from '~/server/utils/auth/session-service'
import { loginThrottler } from '~/server/utils/auth/throttle'
import { writeAudit } from '~/server/utils/audit'
import { parseBody } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const data = parseBody(loginSchema, await readBody(event))

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const throttleKey = `${ip}:${data.email}`
  const limit = loginThrottler.check(throttleKey)
  if (!limit.allowed) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.',
    })
  }

  const { db } = await import('~/server/utils/db')
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, data.email), isNull(users.deletedAt)))
    .limit(1)

  const valid = user ? await verifyPassword(data.password, user.password) : false

  if (!user || !valid || !user.isActive) {
    await writeAudit(event, {
      action: 'auth.login.failed',
      resource: 'auth',
      description: 'Failed login attempt.',
      metadata: { email: data.email },
    })
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid email or password.',
    })
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  const session = await issueSession(event, user.id, Boolean(data.remember))
  if (!session) {
    throw createError({
      statusCode: 403,
      message: 'Account is not active.',
    })
  }

  loginThrottler.reset(throttleKey)
  await writeAudit(event, {
    userId: user.id,
    action: 'auth.login.success',
    resource: 'auth',
    resourceId: user.id,
    description: 'User signed in.',
  })

  return session
})
