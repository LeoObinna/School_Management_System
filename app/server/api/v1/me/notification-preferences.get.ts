/** GET /api/v1/me/notification-preferences — own notification preferences (Phase 17B). */
import { defineEventHandler } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { getNotificationPreferences } from '~/server/services/notifications'

export default defineEventHandler(async (event) => {
  const auth = requireUser(event)
  return getNotificationPreferences(auth.user.id)
})
