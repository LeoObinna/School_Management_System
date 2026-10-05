/**
 * Deterministic date formatting for the public website (Phase 18B).
 *
 * Public pages SSR inside the Worker and hydrate in the browser — the
 * output must be byte-identical on both sides, so locale-sensitive APIs
 * (toLocaleDateString) are avoided in favour of an explicit English
 * month table.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** "12 January 2026" from an ISO-8601 timestamp or YYYY-MM-DD date. */
export function formatPublicDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** "12 Jan 2026" — compact variant for cards and strips. */
export function formatPublicDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * "Sat 14 Mar 2026" style parts for event date blocks; returns null for
 * unparseable input so callers can hide the block.
 */
export function publicDateParts(
  iso: string | null | undefined,
): { day: string; month: string; year: string } | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return {
    day: String(date.getUTCDate()),
    month: MONTHS_SHORT[date.getUTCMonth()]!,
    year: String(date.getUTCFullYear()),
  }
}
