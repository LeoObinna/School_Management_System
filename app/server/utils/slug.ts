/**
 * URL-safe slug helper for configurable academic names ("JSS 1",
 * "2026/2027", "First Term"). Uniquely named to avoid any collision
 * with Nitro auto-imports.
 */
export function smsSlugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}
