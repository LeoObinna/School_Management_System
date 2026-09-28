/** PATCH /api/v1/me/notification-preferences — update own notification preferences (Phase 17B). */
import { defineEventHandler, readBody } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { notificationPreferenceUpdateSchema } from '~/shared/schemas/notifications'
import { updateNotificationPreferences } from '~/server/services/notifications'

export default defineEventHandler(async (event) => {
  const auth = requireUser(event)
  const data = parseBody(
    notificationPreferenceUpdateSchema,
    await readBody(event),
  )
  return updateNotificationPreferences(auth.user.id, data)
})
