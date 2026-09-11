/**
 * Cookie configuration and helpers for auth (README §25).
 *
 * Session cookie: HttpOnly, Secure (when served over HTTPS),
 * SameSite=Lax, path=/. The CSRF cookie is readable by JavaScript
 * (double-submit pattern) but carries no authority on its own.
 */
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie, getRequestHeader } from 'h3'

export const SESSION_COOKIE = 'sms_session'
export const CSRF_COOKIE = 'sms_csrf'
export const CSRF_HEADER = 'x-csrf-token'

/** Whether the request reached us over HTTPS (behind the edge proxy). */
export function isSecureRequest(event: H3Event): boolean {
  const forwarded = getRequestHeader(event, 'x-forwarded-proto')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() === 'https'
  }
  // Node dev server.
  const protocol = (
    event.node?.req as { socket?: { encrypted?: boolean } } | undefined
  )?.socket?.encrypted
  return protocol === true
}

interface SessionCookieOptions {
  remember: boolean
  secure: boolean
  maxAgeSeconds: number
}

export function getSessionToken(event: H3Event): string | undefined {
  return getCookie(event, SESSION_COOKIE)
}

export function setSessionCookie(
  event: H3Event,
  token: string,
  options: SessionCookieOptions,
): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: options.maxAgeSeconds,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, CSRF_COOKIE, { path: '/' })
}

export function setCsrfCookie(
  event: H3Event,
  token: string,
  secure: boolean,
): void {
  setCookie(event, CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
  })
}
