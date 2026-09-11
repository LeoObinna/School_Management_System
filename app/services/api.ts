/**
 * Thin API client for the Nitro backend.
 *
 * Same-origin requests automatically carry the HTTP-only session
 * cookie. For state-changing requests the double-submit CSRF token is
 * read from the (JS-readable) `sms_csrf` cookie and echoed in a header.
 */
import type { FetchOptions } from 'ofetch'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function readCookie(name: string): string | null {
  if (import.meta.server) {
    return null
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]!) : null
}

export function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toString().toUpperCase()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  }

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = readCookie('sms_csrf')
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }

  const config = useRuntimeConfig()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return $fetch<T>(`${config.public.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers,
    // Method is narrowed at runtime; Nitro's fetch generic expects
    // literal HTTP verbs which a dynamic options bag cannot encode.
  } as any) as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: body as FetchOptions['body'] }),
  put: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body: body as FetchOptions['body'] }),
  del: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
}
