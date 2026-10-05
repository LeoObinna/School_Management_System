/**
 * SSR-friendly loaders for the public website endpoints (Phase 18).
 *
 * During SSR the loaders call the server services directly — the page
 * renders inside the same Worker as the API, so no HTTP round-trip is
 * needed and the KV caching in the services still applies. On the
 * client (hydration / later navigations) they hit the public HTTP
 * endpoints through `services/public.ts`.
 *
 * The route-typed global `$fetch`/`useFetch` is deliberately not used:
 * the Nitro route registry exceeds TS's instantiation depth (TS2589).
 * The dynamic server import lives behind `import.meta.server` so it is
 * tree-shaken from the client bundle.
 */
import {
  fetchPublicSiteSettings,
  fetchPublicStats,
} from '~/services/public'
import type { PublicSiteSettings, PublicStats } from '~/shared/types'

/** School identity/branding payload (also used by the public shell). */
export function usePublicSiteSettings() {
  return useAsyncData<PublicSiteSettings | null>(
    'public:school-settings',
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        if (event) {
          const { getPublicSiteSettings } = await import(
            '~/server/services/school-settings'
          )
          return await getPublicSiteSettings(event)
        }
      }
      return await fetchPublicSiteSettings()
    },
    { default: () => null },
  )
}

/** Homepage statistics strip aggregate counts. */
export function usePublicStats() {
  return useAsyncData<PublicStats | null>(
    'public:stats',
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        if (event) {
          const { getPublicStats } = await import('~/server/services/public')
          return await getPublicStats(event)
        }
      }
      return await fetchPublicStats()
    },
    { default: () => null },
  )
}
