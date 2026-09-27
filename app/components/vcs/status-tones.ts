/**
 * Status → badge tone mapping for VcsStatusBadge (08 §29).
 *
 * Presentation-only: every domain may map its own status strings here.
 * Unknown statuses fall back to 'neutral' — never to a semantic tone
 * that could imply a state the system did not assert.
 */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  // Positive / completed
  active: 'success',
  approved: 'success',
  completed: 'success',
  enrolled: 'success',
  paid: 'success',
  present: 'success',
  published: 'success',
  resolved: 'success',

  // In progress / attention
  draft: 'warning',
  late: 'warning',
  partially_paid: 'warning',
  pending: 'warning',
  processing: 'warning',
  submitted: 'warning',

  // Informational
  excused: 'info',
  new: 'info',
  scheduled: 'info',
  unread: 'info',

  // Negative / blocked
  absent: 'danger',
  failed: 'danger',
  overdue: 'danger',
  rejected: 'danger',
  unpaid: 'danger',

  // Inert
  archived: 'neutral',
  closed: 'neutral',
  inactive: 'neutral',
  read: 'neutral',
}

export function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function statusTone(status: string): BadgeTone {
  return TONE_BY_STATUS[normalizeStatus(status)] ?? 'neutral'
}

/** "partially_paid" → "Partially Paid"; keeps any supplied casing. */
export function formatStatusLabel(status: string): string {
  return status
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
