/**
 * Clock-time helpers for timetable conflict detection (README §16).
 *
 * Postgres `time` columns serialize as "HH:MM" or "HH:MM:SS" strings.
 * Slots are treated as half-open intervals [start, end): two slots
 * conflict only when they share strictly positive duration, so a slot
 * ending at 10:00 does not clash with one starting at 10:00.
 */

/** Convert "HH:MM" / "HH:MM:SS" to minutes since midnight. */
export function timeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) {
    throw new TypeError(`Invalid time value: ${value}`)
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0
  return hours * 60 + minutes + seconds / 60
}

/**
 * True when two time slots overlap on the same day. Back-to-back slots
 * (one ends exactly when the other starts) do not overlap.
 */
export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = timeToMinutes(startA)
  const aEnd = timeToMinutes(endA)
  const bStart = timeToMinutes(startB)
  const bEnd = timeToMinutes(endB)
  return aStart < bEnd && bStart < aEnd
}
