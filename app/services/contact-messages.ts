/**
 * Contact inbox API access layer (Phase 18C).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type { ContactMessage, Paginated } from '~/shared/types'
import type {
  ContactMessageListQuery,
  ContactMessageStatusUpdate,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const contactMessagesApi = {
  list: (params?: Partial<ContactMessageListQuery>) =>
    api.get<Paginated<ContactMessage>>('/contact-messages', {
      params: params as Params,
    }),
  get: (id: string) => api.get<ContactMessage>(`/contact-messages/${id}`),
  updateStatus: (id: string, body: ContactMessageStatusUpdate) =>
    api.patch<ContactMessage>(`/contact-messages/${id}/status`, body),
}
