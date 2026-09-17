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
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { announcements } from '../../database/schema'
import type { Audience } from '../../shared/types'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'

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

const queueMessageSchema = announcementPublishedMessageSchema

export type NotificationQueueMessage = AnnouncementPublishedMessage

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
  const rows = await client.execute(sql`
    SELECT count(*)::int AS n
    FROM users u
    WHERE 1=1 ${audienceSqlFragment(audience)}
  `)
  const first = (rows as unknown as Array<{ n: number | string }>)[0]
  return Number(first?.n ?? 0)
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

  const link = '/announcements'
  const audience = row.audience as Audience
  const inserted = await client.execute(sql`
    INSERT INTO notifications
      (user_id, type, title, body, link, status, announcement_id)
    SELECT u.id, 'announcement', ${row.title}, ${row.body}, ${link}, 'unread', ${announcementId}
    FROM users u
    WHERE 1=1 ${audienceSqlFragment(audience)}
    ON CONFLICT (user_id, announcement_id)
    WHERE announcement_id IS NOT NULL
    DO NOTHING
  `)

  return (
    Number((inserted as unknown as { count?: number }).count) ||
    (inserted as unknown as { rowCount?: number }).rowCount ||
    0
  )
}

/**
 * Routes one parsed queue message to its dispatcher. Returns the number
 * of notifications created by this delivery. Throws on malformed
 * payloads (caller decides ack vs retry) — unknown domain records
 * (missing/stale announcement) surface as normal errors too.
 */
export async function dispatchMessage(
  client: SmsDb,
  rawBody: unknown,
): Promise<number> {
  const message = parseQueueMessage(rawBody)
  if (message.kind === 'announcement.published') {
    return dispatchAnnouncement(client, message.announcementId)
  }
  // The discriminated union currently has one member; new kinds extend
  // `announcementPublishedMessageSchema` above and branch here.
  throw new Error(
    `Unsupported notification queue message kind: ${String(
      (message as { kind?: unknown }).kind,
    )}`,
  )
}
