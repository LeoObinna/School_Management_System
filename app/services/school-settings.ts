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

  /**
   * Uploads a replacement logo (multipart; school.settings.update).
   * Stored in R2 and repointed server-side; returns full settings.
   */
  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<SchoolSettings>('/school-settings/logo', form)
  },

  /** Removes the current logo (school.settings.update). */
  removeLogo: () => api.del<SchoolSettings>('/school-settings/logo'),

  /** Same-origin URL for the current logo; append a version to bust cache. */
  logoUrl: (version?: string | number) =>
    `${useRuntimeConfig().public.apiBaseUrl}/school-settings/logo${
      version ? `?v=${version}` : ''
    }`,

  /** Public branding subset — any authenticated user. */
  getPublic: () =>
    api.get<SchoolPublicSettings>('/my/school-settings'),
}
