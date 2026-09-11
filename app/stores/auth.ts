/**
 * Client-side authentication store (UX layer only).
 *
 * It mirrors what the server already enforces — nothing here is
 * authoritative. The server's Nitro middleware/RBAC protect every
 * endpoint; this store drives navigation and conditional rendering.
 */
import { defineStore } from 'pinia'
import { api } from '~/services/api'
import type {
  AuthSessionResponse,
  AuthUser,
  RoleSlug,
  MessageResponse,
} from '~/shared/types'

interface AuthState {
  user: AuthUser | null
  roles: RoleSlug[]
  permissions: string[]
  csrfToken: string
  initialized: boolean
  loading: boolean
}

const WILDCARD_ROLES: RoleSlug[] = ['super_admin']

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    roles: [],
    permissions: [],
    csrfToken: '',
    initialized: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => state.user !== null,

    can: (state) =>
      (permission: string): boolean => {
        if (state.roles.some((role) => WILDCARD_ROLES.includes(role))) {
          return true
        }
        return state.permissions.includes(permission)
      },

    hasRole: (state) =>
      (...roles: string[]): boolean =>
        state.roles.some((role) => roles.includes(role)),
  },

  actions: {
    hydrate(session: AuthSessionResponse) {
      this.user = session.user
      this.roles = session.roles
      this.permissions = session.permissions
      this.csrfToken = session.csrfToken
      this.initialized = true
    },

    reset() {
      this.user = null
      this.roles = []
      this.permissions = []
      this.csrfToken = ''
      this.initialized = true
    },

    /** Loads the current session from the cookie; safe when anonymous. */
    async fetchSession(): Promise<void> {
      this.loading = true
      try {
        const session = await api.get<AuthSessionResponse>('/auth/me')
        this.hydrate(session)
      } catch {
        this.reset()
      } finally {
        this.loading = false
      }
    },

    async ensureInitialized(): Promise<void> {
      if (!this.initialized) {
        await this.fetchSession()
      }
    },

    async login(email: string, password: string, remember = false) {
      const session = await api.post<AuthSessionResponse>('/auth/login', {
        email,
        password,
        remember,
      })
      this.hydrate(session)
    },

    async logout(): Promise<void> {
      try {
        await api.post<MessageResponse>('/auth/logout')
      } finally {
        this.reset()
      }
    },
  },
})
