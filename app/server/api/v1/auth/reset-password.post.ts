/**
 * POST /api/v1/auth/reset-password
 *
 * Validates the signed reset token (purpose, expiry, password-binding),
 * sets the new password hash, and audits the change. Any prior reset
 * token is automatically invalidated because it was bound to the old
 * password hash.
 */
import { defineEventHandler, createError, readBody } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { users } from '~/database/schema'
import { resetPasswordSchema } from '~/shared/schemas'
import type { MessageResponse } from '~/shared/types'
import { verifyToken } from '~/server/utils/auth/tokens'
import {
  hashPassword,
  passwordFingerprint,
} from '~/server/utils/auth/password'
import { base64UrlToBytes, timingSafeEqual } from '~/server/utils/auth/encoding'
import { revokeAllSessions } from '~/server/utils/auth/revocation'
import { writeAudit } from '~/server/utils/audit'
import { parseBody } from '~/server/utils/validation'

export default defineEventHandler(async (event): Promise<MessageResponse> => {
  const data = parseBody(resetPasswordSchema, await readBody(event))
  const config = useRuntimeConfig(event)

  const claims = await verifyToken(
    config.sessionSecret,
    data.token,
    'reset',
  )
  if (!claims) {
    throw createError({
      statusCode: 400,
      message: 'Reset link is invalid or has expired.',
    })
  }

  const { db } = await import('~/server/utils/db')
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      password: users.password,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, claims.sub), isNull(users.deletedAt)))
    .limit(1)

  let fingerprintMatches = false
  if (user) {
    const current = await passwordFingerprint(user.password)
    try {
      fingerprintMatches = timingSafeEqual(
        base64UrlToBytes(current),
        base64UrlToBytes(claims.fp),
      )
    } catch {
      fingerprintMatches = false
    }
  }

  // Constant, non-enumerating failure for unknown user / mismatched email
  // / token already consumed by a password change.
  if (!user || !user.isActive || user.email !== data.email || !fingerprintMatches) {
    throw createError({
      statusCode: 400,
      message: 'Reset link is invalid or has expired.',
    })
  }

  const newHash = await hashPassword(data.password)
  await db
    .update(users)
    .set({ password: newHash, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  // Invalidate every existing session immediately (Phase 13 KV
  // not-before marker); the user must sign in again with the new
  // password. Inert in Node dev where EDGE_KV is not bound.
  await revokeAllSessions(event, user.id)

  await writeAudit(event, {
    userId: user.id,
    action: 'auth.password_reset.completed',
    resource: 'auth',
    resourceId: user.id,
    description: 'Password reset completed; existing sessions revoked.',
  })

  return { message: 'Password updated. You can now sign in.' }
})
