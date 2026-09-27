/**
 * Portal routing helpers (Phase 16A).
 *
 * Shared by the login redirect (pages/auth/login.vue) and the global
 * route guard (middleware/auth.global.ts). Per the Phase 16 owner
 * decision: student/parent/teacher accounts land on their /portal/*
 * home; staff/admin keep the staff dashboard. Among portal roles the
 * mapping prefers teacher > parent > student so a user with several
 * linked profiles lands on the most operational portal. This is
 * UX-only routing — the server's RBAC/row-level checks remain
 * authoritative for every page and endpoint.
 */
import type { RoleSlug } from '~/shared/types'

export const PORTAL_ROLE_ORDER = ['teacher', 'parent', 'student'] as const

export type PortalRole = (typeof PORTAL_ROLE_ORDER)[number]

export const PORTAL_HOMES: Record<PortalRole, string> = {
  teacher: '/portal/teacher',
  parent: '/portal/parent',
  student: '/portal/student',
}

const STAFF_ROLES: RoleSlug[] = ['super_admin', 'admin']

/**
 * The caller's primary portal role, or null when the roles are
 * staff/admin (no portal redirect) or none of the portal roles.
 */
export function primaryPortalRole(roles: RoleSlug[]): PortalRole | null {
  if (roles.some((role) => STAFF_ROLES.includes(role))) {
    return null
  }
  for (const role of PORTAL_ROLE_ORDER) {
    if (roles.includes(role)) return role
  }
  return null
}

/** Post-login landing path for the given roles ('/' for staff/unknown). */
export function landingPathForRoles(roles: RoleSlug[]): string {
  const role = primaryPortalRole(roles)
  return role ? PORTAL_HOMES[role] : '/'
}
