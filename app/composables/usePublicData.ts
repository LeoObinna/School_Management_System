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
 *
 * SSR handlers capture the request event in their own scope and thread
 * it into the services: the ambient request-event context (AsyncLocal
 * Storage) is not guaranteed to survive the dynamic import + async
 * boundary in the Workers runtime, so services resolve the D1 client
 * from the explicit event.
 */
import {
  fetchPublicAcademics,
  fetchPublicAlbum,
  fetchPublicAlbums,
  fetchPublicEvents,
  fetchPublicNews,
  fetchPublicNewsItem,
  fetchPublicSiteSettings,
  fetchPublicStats,
} from '~/services/public'
import type {
  Paginated,
  PublicAcademics,
  PublicAlbum,
  PublicAlbumDetail,
  PublicEvent,
  PublicNewsItem,
  PublicSiteSettings,
  PublicStats,
} from '~/shared/types'

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

// --- 18B content sections ---------------------------------------------------

/** Published, audience-all news, one page. */
export function usePublicNews(page = 1, perPage = 12) {
  return useAsyncData<Paginated<PublicNewsItem> | null>(
    `public:news:p${page}:pp${perPage}`,
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        const { getPublicNews } = await import('~/server/services/public')
        return await getPublicNews({ page, perPage }, event)
      }
      return await fetchPublicNews(page, perPage)
    },
    { default: () => null },
  )
}

/** One published, audience-all news item (null when not found). */
export function usePublicNewsItem(id: string) {
  return useAsyncData<PublicNewsItem | null>(
    `public:news:${id}`,
    async () => {
      try {
        if (import.meta.server) {
          const event = useRequestEvent()
          const { getPublicNewsItem } = await import('~/server/services/public')
          return await getPublicNewsItem(id, event)
        }
        return await fetchPublicNewsItem(id)
      } catch {
        // Generic 404 for drafts/targeted audiences/unknown ids — the
        // page renders its own not-found state.
        return null
      }
    },
    { default: () => null },
  )
}

/** Published, audience-all events (`upcoming` default, or `past`). */
export function usePublicEvents(
  when: 'upcoming' | 'past' = 'upcoming',
  page = 1,
  perPage = 12,
) {
  return useAsyncData<Paginated<PublicEvent> | null>(
    `public:events:${when}:p${page}:pp${perPage}`,
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        const { getPublicEvents } = await import('~/server/services/public')
        return await getPublicEvents({ when, page, perPage }, event)
      }
      return await fetchPublicEvents(when, page, perPage)
    },
    { default: () => null },
  )
}

/** Published gallery albums, one page. */
export function usePublicAlbums(page = 1, perPage = 12) {
  return useAsyncData<Paginated<PublicAlbum> | null>(
    `public:albums:p${page}:pp${perPage}`,
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        const { getPublicAlbums } = await import('~/server/services/public')
        return await getPublicAlbums({ page, perPage }, event)
      }
      return await fetchPublicAlbums(page, perPage)
    },
    { default: () => null },
  )
}

/** One published album with its images (null when not found). */
export function usePublicAlbum(id: string) {
  return useAsyncData<PublicAlbumDetail | null>(
    `public:album:${id}`,
    async () => {
      try {
        if (import.meta.server) {
          const event = useRequestEvent()
          const { getPublicAlbum } = await import('~/server/services/public')
          return await getPublicAlbum(id, event)
        }
        return await fetchPublicAlbum(id)
      } catch {
        return null
      }
    },
    { default: () => null },
  )
}

/** Current session/terms + active class structure with subject names. */
export function usePublicAcademics() {
  return useAsyncData<PublicAcademics | null>(
    'public:academics',
    async () => {
      if (import.meta.server) {
        const event = useRequestEvent()
        if (event) {
          const { getPublicAcademics } = await import('~/server/services/public')
          return await getPublicAcademics(event)
        }
      }
      return await fetchPublicAcademics()
    },
    { default: () => null },
  )
}
