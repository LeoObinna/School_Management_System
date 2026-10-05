/**
 * Notification queue dispatch (Phase 12 Part B).
 *
 * Cloudflare Queues delivers notification fan-out asynchronously: the
 * publish request only marks the announcement `published` and enqueues
 * one small message; the Worker's `queue()` handler (see
 * server/plugins/cloudflare-queue.ts) calls {@link dispatchMessage} to
 * perform the per-recipient work outside the request.
 *
 * Delivery is at-least-once, so fan-out MUST be idempotent. Announcement
 * notifications carry the source `announcement_id`, and the partial
 * unique index `notifications_user_announcement_idx` lets the INSERT
 * `DO NOTHING` on redelivery without creating duplicate rows.
 *
 * In plain Node dev (`nuxt dev`) no queue binding exists; the publish
 * service calls {@link dispatchAnnouncement} directly as a synchronous
 * fallback so notifications are still created.
 */
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  announcements,
  classes,
  notificationDeliveries,
  notifications,
  resultPublications,
  terms,
} from '../../database/schema'
import type { Audience } from '../../shared/types'
import { formatMoney } from '../../shared/utils/money'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { sendEmail } from '../utils/email/resend-client'
import {
  announcementEmail,
  feeReminderEmail,
  paymentReceiptEmail,
  resultPublishedEmail,
  type SchoolBranding,
} from '../utils/email/templates'
import { sendSms } from '../utils/sms/termii-client'
import {
  feeReminderSms,
  resultPublishedSms,
  urgentNoticeSms,
} from '../utils/sms/templates'

/** Base URL used in email CTAs (same hardcode as the Phase 17A fan-out). */
const PORTAL_BASE_URL = 'https://victoriouschildren.school'

// ---------------------------------------------------------------------------
// Message contract
// ---------------------------------------------------------------------------

/**
 * Envelope for messages sent to the `NOTIFICATION_QUEUE` binding.
 * Versioned by `kind`; unknown kinds fail validation (poison messages
 * are acked by the consumer rather than retried forever).
 */
export const announcementPublishedMessageSchema = z.object({
  kind: z.literal('announcement.published'),
  announcementId: z.string().uuid(),
})

export type AnnouncementPublishedMessage = z.infer<
  typeof announcementPublishedMessageSchema
>

export const emailSendMessageSchema = z.object({
  kind: z.literal('email.send'),
  to: z.string().email().max(320),
  subject: z.string().min(1).max(998),
  html: z.string().max(500_000),
  text: z.string().max(500_000),
  notificationId: z.string().uuid().optional(),
})

export type EmailSendMessage = z.infer<typeof emailSendMessageSchema>

/** Phase 17C: a result publication just went live (exam-results publish). */
export const resultPublishedMessageSchema = z.object({
  kind: z.literal('result.published'),
  publicationId: z.string().uuid(),
})

export type ResultPublishedMessage = z.infer<typeof resultPublishedMessageSchema>

/** Phase 17C: a payment just transitioned to verified (Paystack flows). */
export const paymentVerifiedMessageSchema = z.object({
  kind: z.literal('payment.verified'),
  paymentId: z.string().uuid(),
})

export type PaymentVerifiedMessage = z.infer<typeof paymentVerifiedMessageSchema>

/** Phase 17D: one outbound SMS via Termii. */
export const smsSendMessageSchema = z.object({
  kind: z.literal('sms.send'),
  to: z.string().min(5).max(20),
  text: z.string().min(1).max(480),
  notificationId: z.string().uuid().optional(),
})

export type SmsSendMessage = z.infer<typeof smsSendMessageSchema>

const queueMessageSchema = z.union([
  announcementPublishedMessageSchema,
  emailSendMessageSchema,
  resultPublishedMessageSchema,
  paymentVerifiedMessageSchema,
  smsSendMessageSchema,
])

export type NotificationQueueMessage =
  | AnnouncementPublishedMessage
  | EmailSendMessage
  | ResultPublishedMessage
  | PaymentVerifiedMessage
  | SmsSendMessage

/**
 * Parses a raw queue body (a deserialised object, or a JSON string)
 * into a typed message. Throws z.ZodError on malformed/unknown payloads.
 */
export function parseQueueMessage(raw: unknown): NotificationQueueMessage {
  const body =
    typeof raw === 'string'
      ? safeJsonParse(raw)
      : raw
  return queueMessageSchema.parse(body)
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw // let zod produce the validation error
  }
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

/**
 * External provider secrets carried by the queue consumer. Populated from
 * `env` in `server/plugins/cloudflare-queue.ts`. Null/undefined means the
 * provider is not configured — dispatch functions record a failed delivery
 * and return gracefully rather than throwing.
 */
export interface ProviderConfig {
  resend?: { apiKey: string; fromEmail: string }
  termii?: { apiKey: string; senderId: string }
  branding?: SchoolBranding
}

// ---------------------------------------------------------------------------
// Audience targeting (moved from communication.ts for the async path)
// ---------------------------------------------------------------------------

/** Announcement audience → user-role slugs. null = every active user. */
export const AUDIENCE_ROLES: Record<Audience, string[] | null> = {
  all: null,
  admins: ['super_admin', 'admin'],
  staff: ['super_admin', 'admin'],
  teachers: ['teacher'],
  students: ['student'],
  parents: ['parent'],
}

/**
 * Builds the audience WHERE fragment for the `users u` fan-out SELECT.
 * Role slugs are bound as parameters (never interpolated as raw text).
 */
export function audienceSqlFragment(
  audience: Audience,
): ReturnType<typeof sql> {
  const roleSlugs = AUDIENCE_ROLES[audience]
  if (roleSlugs === null) {
    return sql`AND u.is_active = true AND u.deleted_at IS NULL`
  }
  return sql`AND u.is_active = true AND u.deleted_at IS NULL AND u.id IN (
    SELECT ur.user_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.slug IN (${sql.join(
      roleSlugs.map((slug) => sql`${slug}`),
      sql`, `,
    )})
  )`
}

/**
 * Counts active users targeted by an audience WITHOUT inserting
 * notifications. Used by the publish request to report the recipient
 * count (`notified`) immediately while the actual rows are created
 * asynchronously by the consumer.
 */
export async function countAnnouncementRecipients(
  client: SmsDb,
  audience: Audience,
): Promise<number> {
  const row = await client.get<{ n: number | string | null }>(sql`
    SELECT cast(count(*) as integer) AS n
    FROM users u
    WHERE 1=1 ${audienceSqlFragment(audience)}
  `)
  return Number(row?.n ?? 0)
}

/**
 * Idempotently inserts one `announcement` notification per audience
 * recipient for the given published announcement. Returns the number of
 * rows inserted (0 when a redelivery found every row already present).
 *
 * Throws `404` if the announcement does not exist; rows are only created
 * for announcements that reached `published`.
 */
export async function dispatchAnnouncement(
  client: SmsDb,
  announcementId: string,
): Promise<number> {
  const [row] = await client
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      audience: announcements.audience,
      status: announcements.status,
    })
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1)
  if (!row) {
    throw smsNotFound('Announcement not found.')
  }
  if (row.status !== 'published') {
    // A redelivery racing an archive/edit: nothing to fan out. Acknowledge
    // the message as a no-op rather than retrying against a stale row.
    return 0
  }

  // Phase 18A routing move: staff announcements live under /manage/*;
  // `/announcements` is reserved for the public website.
  const link = '/manage/announcements'
  const audience = row.audience as Audience
  const now = new Date().toISOString()
  // The id and created_at must be supplied in SQL: this raw INSERT
  // bypasses Drizzle's client-side $defaultFn. The expression produces
  // a RFC-4122 v4 UUID per row (randomblob is evaluated per row, not
  // once per statement).
  //
  // SQLite supports the partial-index conflict target, so fan-out stays
  // idempotent on redelivery. D1's meta.changes counts only rows that
  // were actually inserted (conflicts skipped by DO NOTHING excluded).
  const result = (await client.run(sql`
    INSERT INTO notifications
      (id, user_id, type, title, body, link, status, announcement_id, created_at)
    SELECT
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4'
        || substr(lower(hex(randomblob(2))), 2) || '-'
        || substr('89ab', abs(random()) % 4 + 1, 1)
        || substr(lower(hex(randomblob(2))), 2) || '-'
        || lower(hex(randomblob(6))),
      u.id, 'announcement', ${row.title}, ${row.body}, ${link}, 'unread', ${announcementId}, ${now}
    FROM users u
    WHERE 1=1 ${audienceSqlFragment(audience)}
    ON CONFLICT (user_id, announcement_id)
    WHERE announcement_id IS NOT NULL
    DO NOTHING
  `)) as unknown as { meta?: { changes?: number } }

  return Number(result.meta?.changes ?? 0)
}

// ---------------------------------------------------------------------------
// Email send dispatch (Phase 17A)
// ---------------------------------------------------------------------------

/**
 * Sends one email via Resend and records the attempt in
 * `notification_deliveries`. Idempotent: if a `sent` delivery already
 * exists for the same notification+channel+recipient, the message is
 * acked without re-sending. Throws on provider failure so the queue
 * consumer retries (transient) or the caller surfaces the error.
 */
export async function dispatchEmailSend(
  client: SmsDb,
  message: EmailSendMessage,
  config: ProviderConfig,
): Promise<number> {
  // Idempotency: skip if already sent for this notification+channel.
  if (message.notificationId) {
    const [existing] = await client
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        sql`${notificationDeliveries.notificationId} = ${message.notificationId}
          AND ${notificationDeliveries.channel} = 'email'
          AND ${notificationDeliveries.recipientAddress} = ${message.to}
          AND ${notificationDeliveries.status} = 'sent'`,
      )
      .limit(1)
    if (existing) {
      return 0 // already delivered
    }
  }

  if (!config.resend) {
    // Provider not configured — record as failed, don't throw (poison
    // the message would just retry forever).
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'email',
      recipientAddress: message.to,
      provider: 'resend',
      status: 'failed',
      errorMessage: 'Resend API key not configured.',
    })
    console.error('[notification-dispatch] email.send: Resend not configured')
    return 0
  }

  try {
    const result = await sendEmail(config.resend.apiKey, {
      from: config.resend.fromEmail,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'email',
      recipientAddress: message.to,
      provider: 'resend',
      providerMessageId: result.id,
      status: 'sent',
      sentAt: new Date().toISOString(),
    })
    return 1
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error'
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'email',
      recipientAddress: message.to,
      provider: 'resend',
      status: 'failed',
      errorMessage: msg,
    })
    throw error // let the queue consumer retry
  }
}

// ---------------------------------------------------------------------------
// SMS send dispatch (Phase 17D)
// ---------------------------------------------------------------------------

/**
 * Sends one SMS via Termii and records the attempt in
 * `notification_deliveries`. Same semantics as {@link dispatchEmailSend}:
 * idempotent when `notificationId` is set, records a failed row (without
 * throwing) when the provider is unconfigured, and throws on provider
 * failure so the queue consumer can retry.
 */
export async function dispatchSmsSend(
  client: SmsDb,
  message: SmsSendMessage,
  config: ProviderConfig,
): Promise<number> {
  if (message.notificationId) {
    const [existing] = await client
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        sql`${notificationDeliveries.notificationId} = ${message.notificationId}
          AND ${notificationDeliveries.channel} = 'sms'
          AND ${notificationDeliveries.recipientAddress} = ${message.to}
          AND ${notificationDeliveries.status} = 'sent'`,
      )
      .limit(1)
    if (existing) {
      return 0 // already delivered
    }
  }

  if (!config.termii) {
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'sms',
      recipientAddress: message.to,
      provider: 'termii',
      status: 'failed',
      errorMessage: 'Termii API key not configured.',
    })
    console.error('[notification-dispatch] sms.send: Termii not configured')
    return 0
  }

  try {
    const result = await sendSms(config.termii.apiKey, {
      to: message.to,
      from: config.termii.senderId,
      text: message.text,
    })
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'sms',
      recipientAddress: message.to,
      provider: 'termii',
      providerMessageId: result.id,
      status: 'sent',
      sentAt: new Date().toISOString(),
    })
    return 1
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error'
    await client.insert(notificationDeliveries).values({
      notificationId: message.notificationId ?? null,
      channel: 'sms',
      recipientAddress: message.to,
      provider: 'termii',
      status: 'failed',
      errorMessage: msg,
    })
    throw error // let the queue consumer retry
  }
}

/**
 * Best-effort SMS for one recipient: gates (provider configured, phone
 * present) are applied by the caller; failures are logged, never thrown.
 */
async function trySendSms(
  client: SmsDb,
  config: ProviderConfig,
  message: Omit<SmsSendMessage, 'kind'>,
  logContext: string,
): Promise<boolean> {
  if (!config.termii || !message.to) return false
  try {
    await dispatchSmsSend(client, { kind: 'sms.send', ...message }, config)
    return true
  } catch (error) {
    console.error(`[notification-dispatch] ${logContext}:`, error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Announcement email fan-out (Phase 17A)
// ---------------------------------------------------------------------------

/**
 * After in-app fan-out, sends an email to every audience recipient who
 * has an email address and has not opted out of announcement emails.
 * Phase 17D: for the `all`/`parents`/`teachers` audiences, also sends an
 * SMS to recipients with `urgent_sms` enabled and a phone number.
 * Returns the number of emails sent. Failures are logged but do not
 * throw — in-app rows are the authoritative record; email/SMS are
 * best-effort.
 */
async function sendAnnouncementEmails(
  client: SmsDb,
  announcementId: string,
  audience: Audience,
  config: ProviderConfig,
): Promise<number> {
  if (!config.branding) return 0

  // Fetch recipients with their emails, phones and preferences.
  const roleSlugs = AUDIENCE_ROLES[audience]
  const roleFilter =
    roleSlugs === null
      ? sql``
      : sql`AND u.id IN (
          SELECT ur.user_id FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE r.slug IN (${sql.join(
            roleSlugs.map((slug) => sql`${slug}`),
            sql`, `,
          )})
        )`

  const recipients = await client.all<{
    userId: string
    email: string | null
    phone: string | null
    announcementEmail: boolean | null
    urgentSms: boolean | null
  }>(sql`
    SELECT u.id AS userId, u.email, u.phone,
      COALESCE(p.announcement_email, 1) AS announcementEmail,
      COALESCE(p.urgent_sms, 1) AS urgentSms
    FROM users u
    LEFT JOIN user_notification_preferences p ON p.user_id = u.id
    WHERE u.is_active = true AND u.deleted_at IS NULL
      AND (u.email IS NOT NULL OR u.phone IS NOT NULL)
      ${roleFilter}
  `)

  const [announcement] = await client
    .select({
      title: announcements.title,
      body: announcements.body,
    })
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1)
  if (!announcement) return 0

  const branding = config.branding
  const portalUrl = `${PORTAL_BASE_URL}/announcements`
  // SMS only for the urgent audiences (Phase 17D plan): a general
  // announcement to admins/staff does not justify SMS cost.
  const smsAudience =
    audience === 'all' || audience === 'parents' || audience === 'teachers'
  const smsText = smsAudience
    ? urgentNoticeSms(branding.schoolName, announcement.title)
    : null
  let sent = 0

  for (const recipient of recipients) {
    if (config.resend && recipient.email && recipient.announcementEmail) {
      const template = announcementEmail(
        branding,
        { title: announcement.title, body: announcement.body },
        portalUrl,
      )
      try {
        await dispatchEmailSend(
          client,
          {
            kind: 'email.send',
            to: recipient.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
          },
          config,
        )
        sent++
      } catch (error) {
        console.error(
          `[notification-dispatch] announcement email to ${recipient.userId}:`,
          error,
        )
      }
    }

    if (smsText && recipient.phone && recipient.urgentSms) {
      await trySendSms(
        client,
        config,
        { to: recipient.phone, text: smsText },
        `announcement SMS to ${recipient.userId}`,
      )
    }
  }
  return sent
}

// ---------------------------------------------------------------------------
// Event-driven notifications (Phase 17C)
// ---------------------------------------------------------------------------

interface ParentRecipientRow {
  userId: string
  email: string | null
  phone: string | null
  parentFirstName: string
  parentLastName: string
  /** Raw COALESCE(pref, 1) from SQLite: 1/0 (or null treated as opted-in). */
  prefAllows: number | null
  /** Raw COALESCE(pref.urgent_sms, 1) — gates the SMS copy. */
  urgentSmsAllows: number | null
}

/**
 * Inserts one in-app notification unless an identical row (same user,
 * type and link) already exists — the link encodes the event id, so
 * at-least-once queue redelivery cannot create duplicates. Returns the
 * notification id, or null when the row already existed.
 */
async function insertNotificationIfAbsent(
  client: SmsDb,
  row: {
    userId: string
    type: string
    title: string
    body: string
    link: string
  },
): Promise<string | null> {
  const [existing] = await client
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, row.userId),
        eq(notifications.type, row.type),
        eq(notifications.link, row.link),
      ),
    )
    .limit(1)
  if (existing) return null
  const id = crypto.randomUUID()
  await client.insert(notifications).values({
    id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    status: 'unread',
  })
  return id
}

/**
 * Best-effort email for one recipient: preference + address + provider
 * gates are applied by the caller; failures are logged, never thrown, so
 * one bad address cannot poison the whole fan-out.
 */
async function trySendEmail(
  client: SmsDb,
  config: ProviderConfig,
  message: Omit<EmailSendMessage, 'kind'>,
  logContext: string,
): Promise<boolean> {
  if (!config.resend || !config.branding || !message.to) return false
  try {
    await dispatchEmailSend(client, { kind: 'email.send', ...message }, config)
    return true
  } catch (error) {
    console.error(`[notification-dispatch] ${logContext}:`, error)
    return false
  }
}

/**
 * Result-published fan-out (Phase 17C): one in-app notification + one
 * email per (parent, student) pair for every active enrollment matching
 * the publication's session/term/class (and section when set). Parents
 * are reached through their linked user account; the
 * `result_published_email` preference gates the email only — the in-app
 * row is always created. No-op (0) when the publication is missing or no
 * longer published.
 */
export async function dispatchResultPublished(
  client: SmsDb,
  publicationId: string,
  config: ProviderConfig,
): Promise<number> {
  const [pub] = await client
    .select({
      sessionId: resultPublications.sessionId,
      termId: resultPublications.termId,
      classId: resultPublications.classId,
      sectionId: resultPublications.sectionId,
      status: resultPublications.status,
    })
    .from(resultPublications)
    .where(eq(resultPublications.id, publicationId))
    .limit(1)
  if (!pub) {
    throw smsNotFound('Result publication not found.')
  }
  if (pub.status !== 'published') {
    // Redelivery racing an edit: nothing to fan out.
    return 0
  }

  const [classRow] = await client
    .select({ name: classes.name })
    .from(classes)
    .where(eq(classes.id, pub.classId))
    .limit(1)
  const [termRow] = await client
    .select({ name: terms.name })
    .from(terms)
    .where(eq(terms.id, pub.termId))
    .limit(1)
  const className = classRow?.name ?? 'their class'
  const termName = termRow?.name ?? 'the term'

  const sectionFilter = pub.sectionId
    ? sql`AND e.section_id = ${pub.sectionId}`
    : sql``
  const recipients = await client.all<
    ParentRecipientRow & {
      studentId: string
      studentFirstName: string
      studentLastName: string
    }
  >(sql`
    SELECT u.id AS userId, u.email,
      COALESCE(p.phone, u.phone) AS phone,
      p.first_name AS parentFirstName, p.last_name AS parentLastName,
      s.id AS studentId, s.first_name AS studentFirstName,
      s.last_name AS studentLastName,
      COALESCE(pref.result_published_email, 1) AS prefAllows,
      COALESCE(pref.urgent_sms, 1) AS urgentSmsAllows
    FROM student_enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN student_parents sp ON sp.student_id = s.id
    JOIN parents p ON p.id = sp.parent_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN user_notification_preferences pref ON pref.user_id = u.id
    WHERE e.session_id = ${pub.sessionId}
      AND e.term_id = ${pub.termId}
      AND e.class_id = ${pub.classId}
      AND e.status = 'active'
      AND p.is_active = true AND p.deleted_at IS NULL
      AND u.is_active = true AND u.deleted_at IS NULL
      ${sectionFilter}
  `)

  let notified = 0
  for (const r of recipients) {
    const studentName = `${r.studentFirstName} ${r.studentLastName}`
    const link = `/portal/parent/report-cards?publication=${publicationId}&student=${r.studentId}`
    const notificationId = await insertNotificationIfAbsent(client, {
      userId: r.userId,
      type: 'result_published',
      title: `Results published — ${studentName}`,
      body: `${termName} results for ${studentName} (${className}) are now available on the portal.`,
      link,
    })
    if (!notificationId) continue // already notified (redelivery)
    notified++

    if (r.prefAllows && config.resend && config.branding && r.email) {
      const parentName = `${r.parentFirstName} ${r.parentLastName}`
      const template = resultPublishedEmail(
        config.branding,
        parentName,
        studentName,
        className,
        termName,
        `${PORTAL_BASE_URL}/portal/parent/report-cards`,
      )
      await trySendEmail(
        client,
        config,
        {
          to: r.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          notificationId,
        },
        `result-published email to ${r.userId}`,
      )
    }

    // Phase 17D: SMS copy for parents who opted into urgent SMS.
    if (r.urgentSmsAllows && config.termii && config.branding && r.phone) {
      await trySendSms(
        client,
        config,
        {
          to: r.phone,
          text: resultPublishedSms(
            config.branding.schoolName,
            studentName,
            termName,
          ),
          notificationId,
        },
        `result-published SMS to ${r.userId}`,
      )
    }
  }
  return notified
}

/**
 * Payment-verified fan-out (Phase 17C): receipt confirmation (in-app +
 * email) to every parent of the student. No-op (0) when the payment is
 * missing/verified-and-already-fanned-out or not in `verified` status.
 * The receipt number comes from payment_receipts (created atomically
 * with verification) and falls back to the payment reference.
 */
export async function dispatchPaymentVerified(
  client: SmsDb,
  paymentId: string,
  config: ProviderConfig,
): Promise<number> {
  const row = await client.get<{
    id: string
    status: string
    amount: number
    paymentReference: string
    invoiceNumber: string
    studentId: string
    studentFirstName: string
    studentLastName: string
    receiptNumber: string | null
  }>(sql`
    SELECT p.id, p.status, p.amount,
      p.payment_reference AS paymentReference,
      i.invoice_number AS invoiceNumber,
      s.id AS studentId, s.first_name AS studentFirstName,
      s.last_name AS studentLastName,
      r.receipt_number AS receiptNumber
    FROM payments p
    JOIN student_invoices i ON i.id = p.invoice_id
    JOIN students s ON s.id = p.student_id
    LEFT JOIN payment_receipts r ON r.payment_id = p.id
    WHERE p.id = ${paymentId}
  `)
  if (!row) {
    throw smsNotFound('Payment not found.')
  }
  if (row.status !== 'verified') {
    return 0
  }

  const recipients = await client.all<ParentRecipientRow>(sql`
    SELECT u.id AS userId, u.email,
      COALESCE(p.phone, u.phone) AS phone,
      p.first_name AS parentFirstName, p.last_name AS parentLastName,
      COALESCE(pref.payment_receipt_email, 1) AS prefAllows,
      COALESCE(pref.urgent_sms, 1) AS urgentSmsAllows
    FROM student_parents sp
    JOIN parents p ON p.id = sp.parent_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN user_notification_preferences pref ON pref.user_id = u.id
    WHERE sp.student_id = ${row.studentId}
      AND p.is_active = true AND p.deleted_at IS NULL
      AND u.is_active = true AND u.deleted_at IS NULL
  `)

  const studentName = `${row.studentFirstName} ${row.studentLastName}`
  const receiptNumber = row.receiptNumber ?? row.paymentReference
  const amount = formatMoney(row.amount)
  let notified = 0

  for (const r of recipients) {
    const link = `/portal/parent/fees?payment=${paymentId}`
    const notificationId = await insertNotificationIfAbsent(client, {
      userId: r.userId,
      type: 'payment_receipt',
      title: `Payment confirmed — ${receiptNumber}`,
      body: `Your payment of ${amount} for ${studentName} (invoice ${row.invoiceNumber}) has been confirmed.`,
      link,
    })
    if (!notificationId) continue
    notified++

    if (!r.prefAllows || !config.resend || !config.branding || !r.email) {
      continue
    }
    const parentName = `${r.parentFirstName} ${r.parentLastName}`
    const template = paymentReceiptEmail(
      config.branding,
      parentName,
      receiptNumber,
      amount,
      studentName,
      row.invoiceNumber,
      `${PORTAL_BASE_URL}/portal/parent/fees`,
    )
    await trySendEmail(
      client,
      config,
      {
        to: r.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        notificationId,
      },
      `payment-receipt email to ${r.userId}`,
    )
  }
  return notified
}

/**
 * Daily fee-reminder fan-out (Phase 17C cron): one consolidated in-app
 * notification + email per parent covering ALL their children's overdue
 * invoices (status issued/partially_paid/overdue, balance > 0, due_date
 * before `today`). Idempotent per day via the `reminder=<today>` link
 * marker, so a re-run within the same UTC day cannot double-notify.
 */
export async function dispatchFeeReminders(
  client: SmsDb,
  config: ProviderConfig,
  today: string,
): Promise<{ parentsNotified: number; emailsSent: number }> {
  interface OverdueRow extends ParentRecipientRow {
    invoiceNumber: string
    balance: number
    dueDate: string | null
    studentFirstName: string
    studentLastName: string
  }
  const rows = await client.all<OverdueRow>(sql`
    SELECT i.invoice_number AS invoiceNumber, i.balance,
      i.due_date AS dueDate,
      s.first_name AS studentFirstName, s.last_name AS studentLastName,
      u.id AS userId, u.email,
      COALESCE(p.phone, u.phone) AS phone,
      p.first_name AS parentFirstName, p.last_name AS parentLastName,
      COALESCE(pref.fee_reminder_email, 1) AS prefAllows,
      COALESCE(pref.urgent_sms, 1) AS urgentSmsAllows
    FROM student_invoices i
    JOIN students s ON s.id = i.student_id
    JOIN student_parents sp ON sp.student_id = s.id
    JOIN parents p ON p.id = sp.parent_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN user_notification_preferences pref ON pref.user_id = u.id
    WHERE i.status IN ('issued', 'partially_paid', 'overdue')
      AND i.balance > 0
      AND i.due_date IS NOT NULL
      AND i.due_date < ${today}
      AND p.is_active = true AND p.deleted_at IS NULL
      AND u.is_active = true AND u.deleted_at IS NULL
  `)

  // Consolidate per parent: one email/notification per parent per day.
  const byParent = new Map<string, OverdueRow[]>()
  for (const row of rows) {
    const list = byParent.get(row.userId)
    if (list) {
      list.push(row)
    } else {
      byParent.set(row.userId, [row])
    }
  }

  let parentsNotified = 0
  let emailsSent = 0
  const link = `/portal/parent/fees?reminder=${today}`

  for (const items of byParent.values()) {
    const first = items[0]!
    const totalBalance = items.reduce((sum, i) => sum + i.balance, 0)
    const notificationId = await insertNotificationIfAbsent(client, {
      userId: first.userId,
      type: 'fee_reminder',
      title: 'Fee reminder',
      body: `${items.length} invoice(s) with an outstanding balance totalling ${formatMoney(totalBalance)}.`,
      link,
    })
    if (!notificationId) continue // already reminded today
    parentsNotified++

    if (first.prefAllows && config.resend && config.branding && first.email) {
      const parentName = `${first.parentFirstName} ${first.parentLastName}`
      const template = feeReminderEmail(
        config.branding,
        parentName,
        items.map((i) => ({
          studentName: `${i.studentFirstName} ${i.studentLastName}`,
          invoiceNumber: i.invoiceNumber,
          balance: formatMoney(i.balance),
          dueDate: i.dueDate,
        })),
        `${PORTAL_BASE_URL}/portal/parent/fees`,
      )
      const sent = await trySendEmail(
        client,
        config,
        {
          to: first.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          notificationId,
        },
        `fee-reminder email to ${first.userId}`,
      )
      if (sent) emailsSent++
    }

    // Phase 17D: SMS copy for parents who opted into urgent SMS.
    if (
      first.urgentSmsAllows &&
      config.termii &&
      config.branding &&
      first.phone
    ) {
      await trySendSms(
        client,
        config,
        {
          to: first.phone,
          text: feeReminderSms(
            config.branding.schoolName,
            items.length,
            formatMoney(totalBalance),
          ),
          notificationId,
        },
        `fee-reminder SMS to ${first.userId}`,
      )
    }
  }
  return { parentsNotified, emailsSent }
}

/**
 * Routes one parsed queue message to its dispatcher. Returns the number
 * of notifications created by this delivery. Throws on malformed
 * payloads (caller decides ack vs retry) — unknown domain records
 * (missing/stale announcement) surface as normal errors too.
 *
 * Phase 17A: accepts an optional {@link ProviderConfig} for external
 * email/SMS delivery. When absent, `email.send` messages are recorded
 * as failed deliveries (provider not configured).
 */
export async function dispatchMessage(
  client: SmsDb,
  rawBody: unknown,
  config?: ProviderConfig,
): Promise<number> {
  const message = parseQueueMessage(rawBody)
  if (message.kind === 'announcement.published') {
    const count = await dispatchAnnouncement(client, message.announcementId)
    // Phase 17A/D: also send emails/SMS to opted-in recipients (best-effort).
    if (config?.branding && (config.resend || config.termii)) {
      const [ann] = await client
        .select({ audience: announcements.audience })
        .from(announcements)
        .where(eq(announcements.id, message.announcementId))
        .limit(1)
      if (ann) {
        await sendAnnouncementEmails(
          client,
          message.announcementId,
          ann.audience as Audience,
          config,
        )
      }
    }
    return count
  }
  if (message.kind === 'email.send') {
    return dispatchEmailSend(client, message, config ?? {})
  }
  if (message.kind === 'sms.send') {
    return dispatchSmsSend(client, message, config ?? {})
  }
  if (message.kind === 'result.published') {
    return dispatchResultPublished(client, message.publicationId, config ?? {})
  }
  if (message.kind === 'payment.verified') {
    return dispatchPaymentVerified(client, message.paymentId, config ?? {})
  }
  throw new Error(
    `Unsupported notification queue message kind: ${String(
      (message as { kind?: unknown }).kind,
    )}`,
  )
}
