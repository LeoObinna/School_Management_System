/**
 * GET /api/v1/school-settings
 * Full school settings (admin only).
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { getSchoolSettings } from '~/server/services/school-settings'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'school.settings.view')
  return getSchoolSettings()
})
