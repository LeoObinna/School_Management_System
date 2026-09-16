/**
 * Communication API access layer (README §21, Phase 10).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type {
  Announcement,
  AnnouncementListItem,
  Message,
  MessageListItem,
  Notification,
  Paginated,
} from '~/shared/types'
import type {
  AnnouncementCreate,
  AnnouncementListQuery,
  AnnouncementUpdate,
  MessageCreate,
  MessageListQuery,
  NotificationListQuery,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const announcementsApi = {
  list: (params?: Partial<AnnouncementListQuery>) =>
    api.get<Paginated<AnnouncementListItem>>('/announcements', {
      params: params as Params,
    }),
  get: (id: string) =>
    api.get<AnnouncementListItem>(`/announcements/${id}`),
  create: (body: AnnouncementCreate) =>
    api.post<AnnouncementListItem>('/announcements', body),
  update: (id: string, body: AnnouncementUpdate) =>
    api.put<AnnouncementListItem>(`/announcements/${id}`, body),
  del: (id: string) =>
    api.del<void>(`/announcements/${id}`),
  publish: (id: string) =>
    api.post<{ announcement: AnnouncementListItem; notified: number }>(
      `/announcements/${id}/publish`,
    ),
  archive: (id: string) =>
    api.post<AnnouncementListItem>(`/announcements/${id}/archive`),
}

export const notificationsApi = {
  list: (params?: Partial<NotificationListQuery>) =>
    api.get<Paginated<Notification>>('/notifications', {
      params: params as Params,
    }),
  markRead: (id: string) =>
    api.post<Notification>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.post<{ updated: number }>('/notifications/read-all'),
  del: (id: string) =>
    api.del<void>(`/notifications/${id}`),
}

export const messagesApi = {
  list: (params?: Partial<MessageListQuery>) =>
    api.get<Paginated<MessageListItem>>('/messages', {
      params: params as Params,
    }),
  get: (id: string) =>
    api.get<MessageListItem>(`/messages/${id}`),
  send: (body: MessageCreate) =>
    api.post<MessageListItem>('/messages', body),
  markRead: (id: string) =>
    api.post<Message>(`/messages/${id}/read`),
}
