/**
 * Pure permission evaluation (no Nitro/h3 imports) so it can be unit
 * tested in isolation and reused on the client if ever needed.
 */

/** Roles that implicitly hold every permission. */
export const WILDCARD_ROLES = new Set(['super_admin'])

export interface PermissionHolder {
  roles: readonly string[]
  permissions: readonly string[]
}

/**
 * Returns true when the holder has the explicit permission slug, or
 * carries a wildcard role (super_admin).
 */
export function hasPermission(
  holder: PermissionHolder | null | undefined,
  permission: string,
): boolean {
  if (!holder) {
    return false
  }
  if (holder.roles.some((role) => WILDCARD_ROLES.has(role))) {
    return true
  }
  return holder.permissions.includes(permission)
}
