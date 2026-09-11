/**
 * POST /api/v1/auth/forgot-password
 *
 * Issues a signed, single-purpose, 1-hour password-reset token bound to
 * the user's current password hash (so it is invalidated the moment the
 * password changes or it is used). Delivery is via Queues/email in
 * Phase 10; until then the token is returned ONLY when the server-only
 * `exposeResetTokens` config is enabled (local development).
 *
 * The response is identical whether or not the email exists.
 */
import { defineEventHandler, readBody } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { users } from '~/database/schema'
import { forgotPasswordSchema } from '~/shared/schemas'
import type { MessageResponse } from '~/shared/types'
import { signToken, RESET_TOKEN_TTL_SECONDS } from '~/server/utils/auth/tokens'
import { passwordFingerprint } from '~/server/utils/auth/password'
import { writeAudit } from '~/server/utils/audit'
import { parseBody } from '~/server/utils/validation'

const GENERIC_MESSAGE =
  'If an account exists for that email, a reset link has been sent.'

export default defineEventHandler(async (event): Promise<
  MessageResponse & { resetToken?: string }
> => {
  const data = parseBody(forgotPasswordSchema, await readBody(event))
  const config = useRuntimeConfig(event)

  const { db } = await import('~/server/utils/db')
  const [user] = await db
    .select({ id: users.id, email: users.email, password: users.password })
    .from(users)
    .where(and(eq(users.email, data.email), isNull(users.deletedAt)))
    .limit(1)

  let resetToken: string | undefined
  if (user) {
    const fingerprint = await passwordFingerprint(user.password)
    resetToken = await signToken(
      config.sessionSecret,
      { sub: user.id, fp: fingerprint },
      { purpose: 'reset', maxAgeSeconds: RESET_TOKEN_TTL_SECONDS },
    )

    await writeAudit(event, {
      userId: user.id,
      action: 'auth.password_reset.requested',
      resource: 'auth',
      resourceId: user.id,
      description: 'Password reset requested.',
    })
    // TODO(Phase 10): enqueue transactional email via Cloudflare Queues.
  }

  return {
    message: GENERIC_MESSAGE,
    ...(config.exposeResetTokens && resetToken ? { resetToken } : {}),
  }
})
