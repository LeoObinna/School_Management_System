/**
 * DELETE /api/v1/school-settings/logo
 *
 * Removes the school logo: clears `school.logo_key` first so the object
 * becomes unreferenced immediately, then deletes the R2 bytes
 * best-effort. Requires school.settings.update.
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import {
  clearSchoolLogoKey,
  getSchoolSettings,
} from '~/server/services/school-settings'
import { deleteObject } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'school.settings.update')
  const previousKey = (await getSchoolSettings(event)).logoKey || null

  const updated = await clearSchoolLogoKey(event)

  if (previousKey) {
    await deleteObject(event, previousKey).catch(() => {})
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'school_settings.logo.remove',
      resource: 'school_settings',
      resourceId: previousKey,
      description: 'Removed the school logo.',
    })
  }
  return updated
})
