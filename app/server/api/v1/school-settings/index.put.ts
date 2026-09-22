/**
 * PUT /api/v1/school-settings
 * Partial update of school settings (admin only). Fields absent from the
 * body are left unchanged.
 */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { schoolSettingsUpdateSchema } from '~/shared/schemas'
import { updateSchoolSettings } from '~/server/services/school-settings'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'school.settings.update')
  const patch = parseBody(schoolSettingsUpdateSchema, await readBody(event))
  const updated = await updateSchoolSettings(patch)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'school_settings.update',
    resource: 'school_settings',
    description: `Updated school settings: ${Object.keys(patch).join(', ')}.`,
    metadata: { fields: Object.keys(patch) },
  })
  return updated
})
