/**
 * Public site navigation data (brief §5). Shared by SiteHeader and
 * SiteFooter. Routes land with Phase 18's public pages; the shell is
 * dormant until a page applies `layout: 'public'`.
 *
 * Pay Fees intentionally routes to the portal login — fee payment is
 * an authenticated portal flow (Phase 18 plan, increment 18B).
 */

export interface PublicLink {
  label: string
  to: string
}

/** Main public navigation, in brief §5 order. */
export const publicNavLinks: PublicLink[] = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Academics', to: '/academics' },
  { label: 'Admissions', to: '/admissions' },
  { label: 'Fees', to: '/fees' },
  { label: 'News', to: '/news' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
]

/** Portal entry points surfaced as public actions. */
export const publicActions: PublicLink[] = [
  { label: 'Apply Now', to: '/admissions' },
  { label: 'Pay Fees', to: '/auth/login' },
  { label: 'Check Results', to: '/results/checker' },
  { label: 'Portal Login', to: '/auth/login' },
]
