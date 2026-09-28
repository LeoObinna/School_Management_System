/**
 * Email templates (Phase 17). Pure functions returning
 * `{ subject, html, text }` — no template engine, just string building.
 * School branding (name, motto, colors) comes from the caller's
 * school-settings snapshot; these functions stay pure for testability.
 */

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface SchoolBranding {
  schoolName: string
  motto: string | null
  primaryColor: string // e.g. '#1a237e'
  logoUrl: string | null
}

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------

function shell(branding: SchoolBranding, content: string): string {
  const mottoLine = branding.motto
    ? `<p style="margin:0;font-size:13px;color:#666;font-style:italic;">${branding.motto}</p>`
    : ''
  const logoImg = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.schoolName}" width="48" height="48" style="display:block;margin:0 auto 8px;" />`
    : ''
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,system-ui,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr><td style="background:${branding.primaryColor};padding:24px 32px;text-align:center;">
    ${logoImg}
    <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">${branding.schoolName}</h1>
    ${mottoLine}
  </td></tr>
  <tr><td style="padding:32px;">
    ${content}
  </td></tr>
  <tr><td style="padding:16px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
    This is an automated message from ${branding.schoolName}. Please do not reply.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;"><tr><td style="border-radius:6px;background:#1a237e;"><a href="${url}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;">${label}</a></td></tr></table>`
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Announcement notification email. */
export function announcementEmail(
  branding: SchoolBranding,
  announcement: { title: string; body: string | null },
  portalUrl: string,
): EmailTemplate {
  const bodyHtml = announcement.body
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">${announcement.body.replace(/\n/g, '<br>')}</p>`
    : ''
  return {
    subject: `[${branding.schoolName}] ${announcement.title}`,
    html: shell(branding, `
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a2e;">${announcement.title}</h2>
      ${bodyHtml}
      ${ctaButton(portalUrl, 'View in Portal')}
    `),
    text: `${announcement.title}\n\n${announcement.body ?? ''}\n\nView in portal: ${portalUrl}`,
  }
}

/** Fee reminder email (overdue invoices). */
export function feeReminderEmail(
  branding: SchoolBranding,
  parentName: string,
  items: Array<{
    studentName: string
    invoiceNumber: string
    balance: string
    dueDate: string | null
  }>,
  portalUrl: string,
): EmailTemplate {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #eee;">${item.studentName}</td>
        <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #eee;">${item.invoiceNumber}</td>
        <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #eee;text-align:right;">${item.balance}</td>
        <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #eee;">${item.dueDate ?? '—'}</td>
      </tr>`,
    )
    .join('')
  return {
    subject: `[${branding.schoolName}] Fee Reminder — Outstanding Balance`,
    html: shell(branding, `
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a2e;">Fee Reminder</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">Dear ${parentName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">The following invoice(s) have outstanding balances:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr style="background:#f8f8f8;">
          <th style="padding:8px 12px;font-size:13px;text-align:left;color:#666;">Student</th>
          <th style="padding:8px 12px;font-size:13px;text-align:left;color:#666;">Invoice</th>
          <th style="padding:8px 12px;font-size:13px;text-align:right;color:#666;">Balance</th>
          <th style="padding:8px 12px;font-size:13px;text-align:left;color:#666;">Due Date</th>
        </tr>
        ${rows}
      </table>
      ${ctaButton(portalUrl, 'Pay Now')}
    `),
    text: `Fee Reminder\n\nDear ${parentName},\n\nThe following invoice(s) have outstanding balances:\n\n${items.map((i) => `  ${i.studentName} — ${i.invoiceNumber}: ${i.balance} (due ${i.dueDate ?? '—'})`).join('\n')}\n\nPay now: ${portalUrl}`,
  }
}

/** Result published notification email. */
export function resultPublishedEmail(
  branding: SchoolBranding,
  parentName: string,
  studentName: string,
  className: string,
  termName: string,
  portalUrl: string,
): EmailTemplate {
  return {
    subject: `[${branding.schoolName}] Results Published — ${studentName}`,
    html: shell(branding, `
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a2e;">Results Published</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">Dear ${parentName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">The <strong>${termName}</strong> results for <strong>${studentName}</strong> (${className}) have been published and are now available on the portal.</p>
      ${ctaButton(portalUrl, 'View Results')}
    `),
    text: `Results Published\n\nDear ${parentName},\n\nThe ${termName} results for ${studentName} (${className}) have been published.\n\nView results: ${portalUrl}`,
  }
}

/** Payment receipt confirmation email. */
export function paymentReceiptEmail(
  branding: SchoolBranding,
  parentName: string,
  receiptNumber: string,
  amount: string,
  studentName: string,
  invoiceNumber: string,
  portalUrl: string,
): EmailTemplate {
  return {
    subject: `[${branding.schoolName}] Payment Receipt — ${receiptNumber}`,
    html: shell(branding, `
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a2e;">Payment Confirmed</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">Dear ${parentName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">We have received your payment of <strong>${amount}</strong> for <strong>${studentName}</strong> (Invoice ${invoiceNumber}).</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">Receipt number: <strong>${receiptNumber}</strong></p>
      ${ctaButton(portalUrl, 'View Receipt')}
    `),
    text: `Payment Confirmed\n\nDear ${parentName},\n\nWe have received your payment of ${amount} for ${studentName} (Invoice ${invoiceNumber}).\nReceipt number: ${receiptNumber}\n\nView receipt: ${portalUrl}`,
  }
}
