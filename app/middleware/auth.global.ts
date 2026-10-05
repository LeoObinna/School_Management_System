/**
 * Global client-side route guard (UX only — README §25: the Nitro
 * server middleware is authoritative).
 *
 * Pages opt out of auth via definePageMeta({ public: true }) or live
 * under /auth, and can declare required permission slugs via
 * definePageMeta({ permissions: ['students.view'] }).
 *
 * Phase 16A: student/parent/teacher accounts are routed to their
 * /portal/* home instead of the staff dashboard (landingPathForRoles).
 * Phase 18A: `/` is the public homepage; the staff dashboard moved to
 * /dashboard.
 */
import { useAuthStore } from '~/stores/auth'
import { landingPathForRoles } from '~/utils/portal'

export default defineNuxtRouteMiddleware(async (to) => {
  // SSR cannot read the HttpOnly cookie reliably here; let the client
  // guard run after hydration.
  if (import.meta.server) {
    return
  }

  const auth = useAuthStore()
  const isAuthRoute = to.path.startsWith('/auth')
  const isPublic = to.meta.public === true || isAuthRoute

  await auth.ensureInitialized()

  if (!isPublic && !auth.isAuthenticated) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    })
  }

  if (isAuthRoute && auth.isAuthenticated) {
    return navigateTo(landingPathForRoles(auth.roles))
  }

  // Phase 18A: `/` is the public homepage; the staff dashboard lives at
  // /dashboard. Portal-role users who navigate to the staff dashboard are
  // sent to their portal home instead (staff/admin stay).
  if (auth.isAuthenticated && to.path === '/dashboard') {
    const landing = landingPathForRoles(auth.roles)
    if (landing !== '/dashboard') {
      return navigateTo(landing)
    }
  }

  const required = Array.isArray(to.meta.permissions)
    ? (to.meta.permissions as string[])
    : []
  if (required.length > 0 && !required.every((permission) => auth.can(permission))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You do not have access to this page.',
      fatal: true,
    })
  }
})
