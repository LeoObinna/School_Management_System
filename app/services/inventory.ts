/**
 * Inventory API access layer (Phase 14C).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type {
  InventoryItemListItem,
  Paginated,
} from '~/shared/types'
import type {
  InventoryItemCreate,
  InventoryItemUpdate,
  InventoryListQuery,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const inventoryApi = {
  list: (params?: Partial<InventoryListQuery>) =>
    api.get<Paginated<InventoryItemListItem>>('/inventory', {
      params: params as Params,
    }),
  get: (id: string) =>
    api.get<InventoryItemListItem>(`/inventory/${id}`),
  create: (body: InventoryItemCreate) =>
    api.post<InventoryItemListItem>('/inventory', body),
  update: (id: string, body: InventoryItemUpdate) =>
    api.put<InventoryItemListItem>(`/inventory/${id}`, body),
  remove: (id: string) => api.del<{ ok: boolean }>(`/inventory/${id}`),
}
