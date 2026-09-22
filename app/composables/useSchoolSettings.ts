/**
 * Public school branding (Phase 14A).
 *
 * Any authenticated user can read the school's name, motto, logo and
 * brand colors. Downstream components (document headers, receipts,
 * app chrome) consume this instead of hard-coded values.
 */
import type { SchoolPublicSettings } from '~/shared/types'

const DEFAULTS: SchoolPublicSettings = {
  name: 'Victorious Children School',
  motto: '',
  address: '',
  email: '',
  phone: '',
  logoKey: '',
  primaryColor: '#1a237e',
  secondaryColor: '#1a1a2e',
}

const settings = ref<SchoolPublicSettings>({ ...DEFAULTS })
let loaded = false

/**
 * Returns the public school settings. Fetches once on first call (client
 * only — SSR has no session cookie). Safe to call repeatedly.
 */
export function useSchoolSettings() {
  async function load() {
    if (loaded || import.meta.server) return
    loaded = true
    try {
      const { schoolSettingsApi } = await import('~/services/school-settings')
      settings.value = await schoolSettingsApi.getPublic()
    } catch {
      // Fall back to defaults on error — branding must never block the UI.
    }
  }

  // Kick off on the client.
  if (!loaded) {
    load()
  }

  return { settings, load }
}
