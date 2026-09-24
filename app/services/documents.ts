/**
 * Documents API access layer (Phase 14B).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type { DocumentListItem } from '~/shared/types'
import type {
  DocumentCreate,
  DocumentListQuery,
  DocumentUpdate,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const documentsApi = {
  list: (params?: Partial<DocumentListQuery>) =>
    api.get<{ data: DocumentListItem[] }>('/documents', {
      params: params as Params,
    }),
  get: (id: string) => api.get<DocumentListItem>(`/documents/${id}`),
  create: (form: FormData) =>
    api.post<DocumentListItem>('/documents', form),
  update: (id: string, body: DocumentUpdate) =>
    api.put<DocumentListItem>(`/documents/${id}`, body),
  remove: (id: string) => api.del<{ ok: boolean }>(`/documents/${id}`),
  /** Authorized download URL (the endpoint streams bytes inline/attachment). */
  downloadUrl: (id: string) =>
    `${useRuntimeConfig().public.apiBaseUrl}/documents/${id}/download`,
}

export type { DocumentCreate }
