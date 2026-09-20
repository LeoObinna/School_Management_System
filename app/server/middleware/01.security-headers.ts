/**
 * Baseline security response headers (Phase 13).
 *
 * Applied to every response (pages and API) at the edge. Headers are
 * set before the route runs; route handlers may override individual
 * values (e.g. R2 downloads setting Content-Disposition). No caching
 * directive is added globally — authenticated responses already carry
 * 'no-store' where required, and the Static Assets layer owns public
 * asset caching.
 *
 * Content-Security-Policy is intentionally NOT set here yet: the Nuxt
 * hydration + inline payload scripts need a tested nonce/strict policy,
 * tracked as a Phase 13 staging-review follow-up.
 */
import { defineEventHandler, setResponseHeaders } from 'h3'

const SECURITY_HEADERS: Record<string, string> = {
  // Force HTTPS for two years, including subdomains. Workers only ever
  // serves over TLS, so this is safe on workers.dev and custom domains.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy-Report-Only':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'",
  // Clickjacking protection that modern browsers honour.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // No optional browser features until a feature explicitly needs one.
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

export default defineEventHandler((event) => {
  setResponseHeaders(event, SECURITY_HEADERS)
})
