/**
 * GET /api/v1/my/school-settings
 * Public branding/identity subset — any authenticated user may read this
 * (school name, motto, logo, colors). Excludes bank details and internal
 * finance/academic config.
 */
import { defineEventHandler } from 'h3'
import { requireUser } from '~/server/utils/auth/rbac'
import { getPublicSchoolSettings } from '~/server/services/school-settings'

export default defineEventHandler(async (event) => {
  requireUser(event)
  return getPublicSchoolSettings(event)
})
