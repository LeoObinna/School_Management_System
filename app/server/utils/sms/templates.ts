/**
 * SMS templates (Phase 17D). Pure functions returning a single text
 * string, defensively truncated to 160 GSM characters so every message
 * stays a single SMS segment.
 */

export const SMS_MAX_LENGTH = 160

/** Hard-truncates to {@link SMS_MAX_LENGTH} chars (with ellipsis). */
export function truncateSms(text: string, max = SMS_MAX_LENGTH): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function shortName(schoolName: string): string {
  // Keep the prefix short: first two words of the school name.
  return schoolName.split(/\s+/).slice(0, 2).join(' ')
}

/** Urgent announcement notice (audiences all/parents/teachers). */
export function urgentNoticeSms(schoolName: string, title: string): string {
  return truncateSms(
    `${shortName(schoolName)} NOTICE: ${title}. See the portal for details.`,
  )
}

/** Consolidated overdue-fee reminder (one per parent per day). */
export function feeReminderSms(
  schoolName: string,
  invoiceCount: number,
  totalBalance: string,
): string {
  return truncateSms(
    `${shortName(schoolName)} fee reminder: ${invoiceCount} invoice(s) totalling ${totalBalance} overdue. Please pay via the portal.`,
  )
}

/** Result-published notice (per parent-student). */
export function resultPublishedSms(
  schoolName: string,
  studentName: string,
  termName: string,
): string {
  return truncateSms(
    `${shortName(schoolName)}: ${termName} results for ${studentName} are now published. View on the portal.`,
  )
}
