/**
 * Service/API boundary helpers.
 *
 * Drizzle row types carry `Date` instances for timestamps; h3 serializes
 * responses to JSON where those become ISO-8601 strings (the shared
 * `shared/types` view). These helpers make that single controlled cast
 * explicit instead of scattering `as unknown as T` across services.
 */
export function toJsonModel<T>(row: unknown): T {
  return row as T
}

export function toJsonList<T>(rows: readonly unknown[]): T[] {
  return rows as T[]
}
