/**
 * School settings API access layer (Phase 14A).
 * Mirrors the Nitro routes under /api/v1/school-settings and
 * /api/v1/my/school-settings.
 */
import { api } from './api'
import type { SchoolSettings, SchoolPublicSettings } from '~/shared/types'
import type { SchoolSettingsUpdate } from '~/shared/schemas'

export const schoolSettingsApi = {
  /** Full settings (requires school.settings.view). */
  get: () => api.get<SchoolSettings>('/school-settings'),

  /** Partial update (requires school.settings.update). */
  update: (patch: SchoolSettingsUpdate) =>
    api.put<SchoolSettings>('/school-settings', patch),

  /** Public branding subset — any authenticated user. */
  getPublic: () =>
    api.get<SchoolPublicSettings>('/my/school-settings'),
}
