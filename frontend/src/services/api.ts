import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiErrorShape } from '@/types/api'

/**
 * Central API client. Components must never call axios/fetch directly —
 * import `api` or a domain service built on top of it.
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
})

/** Convert arbitrary HTTP failures into a stable, UI-safe shape. */
export function normalizeApiError(error: unknown): ApiErrorShape {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined

    return {
      message:
        data?.message ??
        (error.response
          ? `Request failed with status ${error.response.status}`
          : 'Network error — the API could not be reached.'),
      status: error.response?.status ?? null,
      errors: data?.errors,
    }
  }

  return {
    message: error instanceof Error ? error.message : 'Unexpected error.',
    status: null,
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
)
