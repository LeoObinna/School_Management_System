/**
 * Typed client for the unauthenticated `/api/v1/public/*` endpoints
 * (Phase 18). Public pages fetch through the composables in
 * `composables/usePublicData.ts` so SSR renders inside the Worker;
 * responses are cached server-side (KV) and via Cache-Control on the
 * endpoints themselves.
 *
 * Plain ofetch is used instead of the route-typed global `$fetch` — the
 * Nitro route registry exceeds TS's instantiation depth (TS2589); the
 * explicit generics keep every payload fully typed.
 */
import { $fetch as ofetch } from 'ofetch'
import type { PublicSiteSettings, PublicStats } from '~/shared/types'

export function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  return ofetch<PublicSiteSettings>('/api/v1/public/school-settings')
}

export function fetchPublicStats(): Promise<PublicStats> {
  return ofetch<PublicStats>('/api/v1/public/stats')
}
