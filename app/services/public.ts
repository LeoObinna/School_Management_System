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
import type {
  AdmissionStatusQuery,
  AdmissionStatusResponse,
  ContactMessageCreate,
  ContactMessageResponse,
  PublicApplication,
  PublicApplicationResponse,
} from '~/shared/schemas/public'

export function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  return ofetch<PublicSiteSettings>('/api/v1/public/school-settings')
}

export function fetchPublicStats(): Promise<PublicStats> {
  return ofetch<PublicStats>('/api/v1/public/stats')
}

// --- 18B content sections ---------------------------------------------------

function listQuery(params: Record<string, string | number>): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  return qs ? `?${qs}` : ''
}

export function fetchPublicNews(
  page = 1,
  perPage = 12,
): Promise<Paginated<PublicNewsItem>> {
  return ofetch<Paginated<PublicNewsItem>>(
    `/api/v1/public/news${listQuery({ page, perPage })}`,
  )
}

export function fetchPublicNewsItem(id: string): Promise<PublicNewsItem> {
  return ofetch<PublicNewsItem>(`/api/v1/public/news/${id}`)
}

export function fetchPublicEvents(
  when: 'upcoming' | 'past' = 'upcoming',
  page = 1,
  perPage = 12,
): Promise<Paginated<PublicEvent>> {
  return ofetch<Paginated<PublicEvent>>(
    `/api/v1/public/events${listQuery({ when, page, perPage })}`,
  )
}

export function fetchPublicAlbums(
  page = 1,
  perPage = 12,
): Promise<Paginated<PublicAlbum>> {
  return ofetch<Paginated<PublicAlbum>>(
    `/api/v1/public/gallery/albums${listQuery({ page, perPage })}`,
  )
}

export function fetchPublicAlbum(id: string): Promise<PublicAlbumDetail> {
  return ofetch<PublicAlbumDetail>(`/api/v1/public/gallery/albums/${id}`)
}

export function fetchPublicAcademics(): Promise<PublicAcademics> {
  return ofetch<PublicAcademics>('/api/v1/public/academics')
}

// --- 18C public forms --------------------------------------------------------

export function submitPublicApplication(
  body: PublicApplication,
): Promise<PublicApplicationResponse> {
  return ofetch<PublicApplicationResponse>(
    '/api/v1/public/admissions/applications',
    { method: 'POST', body },
  )
}

export function fetchPublicApplicationStatus(
  query: AdmissionStatusQuery,
): Promise<AdmissionStatusResponse> {
  const qs = new URLSearchParams(
    Object.entries({ applicationNumber: query.applicationNumber, guardianEmail: query.guardianEmail, guardianPhone: query.guardianPhone })
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString()
  return ofetch<AdmissionStatusResponse>(
    `/api/v1/public/admissions/status?${qs}`,
  )
}

export function sendPublicContactMessage(
  body: ContactMessageCreate,
): Promise<ContactMessageResponse> {
  return ofetch<ContactMessageResponse>('/api/v1/public/contact', {
    method: 'POST',
    body,
  })
}
