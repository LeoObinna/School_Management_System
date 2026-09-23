/**
 * Admin user-management API access layer (Phase 6).
 * Pages never call $fetch directly; they go through these typed wrappers.
 */
import { api } from './api'
import type {
  AdminResetPassword,
  UserCreate,
  UserRolesUpdate,
  UserUpdate,
} from '~/shared/schemas'
import type {
  Paginated,
  RoleDetail,
  RoleListItem,
  UserDetail,
  UserListItem,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const usersApi = {
  listUsers: (params?: Params) =>
    api.get<Paginated<UserListItem>>('/users', { params }),
  getUser: (id: string) => api.get<UserDetail>(`/users/${id}`),
  createUser: (body: UserCreate) => api.post<UserDetail>('/users', body),
  updateUser: (id: string, body: UserUpdate) =>
    api.put<UserDetail>(`/users/${id}`, body),
  deleteUser: (id: string) =>
    api.del<{ message: string }>(`/users/${id}`),
  resetUserPassword: (id: string, body: AdminResetPassword) =>
    api.post<{ message: string }>(`/users/${id}/reset-password`, body),
  setUserRoles: (id: string, body: UserRolesUpdate) =>
    api.put<UserDetail>(`/users/${id}/roles`, body),
}

export const rolesApi = {
  listRoles: () => api.get<{ data: RoleListItem[]; total: number }>('/roles'),
  getRole: (id: string) => api.get<RoleDetail>(`/roles/${id}`),
}
