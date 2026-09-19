/**
 * Events and gallery API access layer (README §22, Phase 10).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type {
  GalleryAlbumDetail,
  GalleryAlbumListItem,
  Paginated,
  SchoolEventListItem,
} from '~/shared/types'
import type {
  AlbumCreate,
  AlbumListQuery,
  AlbumUpdate,
  EventCreate,
  EventListQuery,
  EventUpdate,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBaseUrl}${path}`
}

export const eventsApi = {
  list: (params?: Partial<EventListQuery>) =>
    api.get<Paginated<SchoolEventListItem>>('/events', {
      params: params as Params,
    }),
  get: (id: string) =>
    api.get<SchoolEventListItem>(`/events/${id}`),
  create: (body: EventCreate) =>
    api.post<SchoolEventListItem>('/events', body),
  update: (id: string, body: EventUpdate) =>
    api.put<SchoolEventListItem>(`/events/${id}`, body),
  del: (id: string) =>
    api.del<void>(`/events/${id}`),
}

export const galleryApi = {
  listAlbums: (params?: Partial<AlbumListQuery>) =>
    api.get<Paginated<GalleryAlbumListItem>>('/gallery/albums', {
      params: params as Params,
    }),
  getAlbum: (id: string) =>
    api.get<GalleryAlbumDetail>(`/gallery/albums/${id}`),
  createAlbum: (body: AlbumCreate) =>
    api.post<GalleryAlbumListItem>('/gallery/albums', body),
  updateAlbum: (id: string, body: AlbumUpdate) =>
    api.put<GalleryAlbumListItem>(`/gallery/albums/${id}`, body),
  deleteAlbum: (id: string) =>
    api.del<void>(`/gallery/albums/${id}`),
  uploadImage: (albumId: string, form: FormData) =>
    api.post<GalleryAlbumDetail>(
      `/gallery/albums/${albumId}/images`,
      form,
    ),
  deleteImage: (albumId: string, imageId: string) =>
    api.del<GalleryAlbumDetail>(
      `/gallery/albums/${albumId}/images/${imageId}`,
    ),
  imageUrl: (albumId: string, imageId: string) =>
    apiUrl(`/gallery/albums/${albumId}/images/${imageId}`),
  thumbnailUrl: (albumId: string, imageId: string) =>
    apiUrl(
      `/gallery/albums/${albumId}/images/${imageId}/thumbnail`,
    ),
}
