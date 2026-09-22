/**
 * Communication domain service (README §21, Phase 10).
 *
 * Announcements support draft/scheduled/published/archived and audience
 * targeting. Publishing an announcement enqueues an
 * `announcement.published` message on NOTIFICATION_QUEUE; the Worker
 * queue consumer (server/plugins/cloudflare-queue.ts →
 * services/notification-dispatch.ts) creates the per-recipient
 * notification rows asynchronously and idempotently (Phase 12 Part B).
 * In plain Node dev without a queue binding, fan-out runs inline.
 * Messages are internal user-to-user.
 */
import {
  and,
  desc,
  eq,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { SmsDb } from '../utils/pagination'
import {
  smsConflict,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import { toJsonList, toJsonModel } from '../utils/serialize'
import {
  announcements,
  messages,
  notifications,
  users,
} from '../../database/schema'
import type {
  AnnouncementCreate,
  AnnouncementListQuery,
  AnnouncementUpdate,
  MessageCreate,
  MessageListQuery,
  NotificationListQuery,
} from '../../shared/schemas'
import type {
  Announcement,
  AnnouncementListItem,
  Audience,
  Message,
  MessageListItem,
  Notification,
  Paginated,
} from '../../shared/types'
import {
  countAnnouncementRecipients,
  dispatchAnnouncement,
} from './notification-dispatch'
import {
  sendNotification,
  type NotificationQueueLike,
} from '../utils/notifications-queue'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

export interface CommunicationActor {
  userId: string
}

// drizzle's and() is typed as SQL | undefined; collapse to SQL.
function all(conditions: Array<SQL | undefined>): SQL {
  return and(...conditions) ?? sql`true`
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

type AnnouncementRow = typeof announcements.$inferSelect

async function announcementOrThrow(
  client: SmsDb,
  id: string,
): Promise<AnnouncementRow> {
  const [row] = await client
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Announcement not found.')
  return row
}

export async function listAnnouncements(
  query: AnnouncementListQuery,
): Promise<Paginated<AnnouncementListItem>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    query.status ? eq(announcements.status, query.status) : undefined,
    query.audience ? eq(announcements.audience, query.audience) : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(
        ilike(announcements.title, pattern),
        ilike(announcements.body, pattern),
      )!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(announcements)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select({
      announcement: announcements,
      authorName: users.name,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(filter)
    .orderBy(desc(announcements.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const data: AnnouncementListItem[] = rows.map((r) => ({
    ...toJsonModel<Announcement>(r.announcement),
    authorName: r.authorName ?? null,
  }))

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getAnnouncement(
  id: string,
): Promise<AnnouncementListItem> {
  const client = await db()
  const [row] = await client
    .select({
      announcement: announcements,
      authorName: users.name,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Announcement not found.')
  return {
    ...toJsonModel<Announcement>(row.announcement),
    authorName: row.authorName ?? null,
  }
}

/**
 * Resolves the scheduled_for value for a create/update, enforcing:
 * scheduled status needs a timestamp, and freshly supplied timestamps
 * must be in the future. Returns null for every non-scheduled status.
 */
function resolveScheduledFor(
  status: string,
  supplied: string | null | undefined,
  existing: string | null,
): string | null {
  if (status !== 'scheduled') {
    return null
  }
  if (supplied !== undefined) {
    if (!supplied) {
      throw smsFieldError(
        'scheduledFor',
        'A future scheduledFor is required for a scheduled announcement.',
      )
    }
    const when = new Date(supplied)
    if (when.getTime() <= Date.now()) {
      throw smsFieldError('scheduledFor', 'Scheduled time must be in the future.')
    }
    return when.toISOString()
  }
  if (existing) {
    return existing
  }
  throw smsFieldError(
    'scheduledFor',
    'A future scheduledFor is required for a scheduled announcement.',
  )
}

export async function createAnnouncement(
  input: AnnouncementCreate,
  actor: CommunicationActor,
): Promise<AnnouncementListItem> {
  const status = input.status ?? 'draft'
  const scheduledFor =
    status === 'scheduled' && input.scheduledFor !== undefined
      ? resolveScheduledFor(status, input.scheduledFor, null)
      : null

  const client = await db()
  const [row] = await client
    .insert(announcements)
    .values({
      title: input.title,
      body: input.body ?? null,
      audience: input.audience ?? 'all',
      classId: input.classId ?? null,
      status,
      scheduledFor,
      authorId: actor.userId,
      publishedAt: status === 'published' ? new Date().toISOString() : null,
    })
    .returning()
  return getAnnouncement(row!.id)
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementUpdate,
): Promise<AnnouncementListItem> {
  const client = await db()
  const row = await announcementOrThrow(client, id)
  if (row.status !== 'draft' && row.status !== 'scheduled') {
    throw smsConflict(
      `Only draft or scheduled announcements can be edited. Current status is "${row.status}".`,
    )
  }
  const nextStatus = input.status ?? row.status
  const scheduledFor = resolveScheduledFor(
    nextStatus,
    input.scheduledFor,
    row.scheduledFor,
  )
  await client
    .update(announcements)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.classId !== undefined && { classId: input.classId }),
      ...(input.status !== undefined && { status: input.status }),
      scheduledFor,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(announcements.id, id))
  return getAnnouncement(id)
}

export async function deleteAnnouncement(
  id: string,
): Promise<void> {
  const client = await db()
  const row = await announcementOrThrow(client, id)
  if (row.status !== 'draft') {
    throw smsConflict(
      `Only draft announcements can be deleted. Current status is "${row.status}".`,
    )
  }
  await client.delete(announcements).where(eq(announcements.id, id))
}

export async function publishAnnouncement(
  id: string,
  actor: CommunicationActor,
  queue: NotificationQueueLike | null,
): Promise<{ announcement: AnnouncementListItem; notified: number }> {
  const client = await db()
  const row = await announcementOrThrow(client, id)
  if (row.status !== 'draft' && row.status !== 'scheduled') {
    throw smsConflict(
      `Only draft or scheduled announcements can be published. Current status is "${row.status}".`,
    )
  }

  const audience = row.audience as Audience

  // 1. Flip to published. Notification fan-out is intentionally outside
  //    this transaction: it runs asynchronously through the queue.
  await client.transaction(async (tx) => {
    await tx
      .update(announcements)
      .set({
        status: 'published',
        scheduledFor: null,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(announcements.id, id))
  })

  // 2. Recipient count is reported immediately (`notified` in the API
  //    response); the per-recipient rows are created by the consumer.
  const notified = await countAnnouncementRecipients(client, audience)

  // 3. Enqueue fan-out. Under Workers the message goes to
  //    NOTIFICATION_QUEUE and the queue() consumer inserts the rows
  //    idempotently. In plain Node dev there is no binding, so fan out
  //    inline to preserve current behaviour.
  if (queue) {
    await sendNotification(queue, {
      kind: 'announcement.published',
      announcementId: id,
    })
  } else {
    await dispatchAnnouncement(client, id)
  }

  const updated = await getAnnouncement(id)
  return { announcement: updated, notified }
}

/**
 * Cron entry point (Phase 13): publishes announcements whose status is
 * 'scheduled' and scheduled_for is due. Runs every 5 minutes via a
 * Nitro scheduled Task (Cron Trigger) and processes at most 50 rows per
 * run.
 *
 * Takes an explicit Drizzle client because cron invocations have no
 * request event for the request-scoped db() proxy. The conditional
 * UPDATE (status must still be 'scheduled') is the claim: overlapping
 * cron runs or a manual publish racing the cron cannot double-publish.
 * Fan-out then reuses the exact queue path as a manual publish; the
 * consumer's partial unique index makes notification creation
 * idempotent regardless.
 */
export async function publishDueAnnouncements(
  client: SmsDb,
  queue: NotificationQueueLike | null,
  now: string = new Date().toISOString(),
): Promise<{ published: number; notified: number }> {
  const due = await client
    .select({
      id: announcements.id,
      audience: announcements.audience,
    })
    .from(announcements)
    .where(
      and(
        eq(announcements.status, 'scheduled'),
        lte(announcements.scheduledFor, now),
      ),
    )
    .orderBy(announcements.scheduledFor)
    .limit(50)

  let published = 0
  let notified = 0

  for (const item of due) {
    const claimed = await client
      .update(announcements)
      .set({
        status: 'published',
        scheduledFor: null,
        publishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(announcements.id, item.id),
          eq(announcements.status, 'scheduled'),
        ),
      )
      .returning({ id: announcements.id })

    if (claimed.length === 0) {
      // Lost the race (manual publish or a parallel cron run).
      continue
    }

    published += 1
    const recipients = await countAnnouncementRecipients(
      client,
      item.audience as Audience,
    )
    notified += recipients

    if (queue) {
      await sendNotification(queue, {
        kind: 'announcement.published',
        announcementId: item.id,
      })
    } else {
      await dispatchAnnouncement(client, item.id)
    }
  }

  return { published, notified }
}

export async function archiveAnnouncement(
  id: string,
): Promise<AnnouncementListItem> {
  const client = await db()
  const row = await announcementOrThrow(client, id)
  if (row.status !== 'published') {
    throw smsConflict(
      `Only published announcements can be archived. Current status is "${row.status}".`,
    )
  }
  await client
    .update(announcements)
    .set({ status: 'archived', updatedAt: new Date().toISOString() })
    .where(eq(announcements.id, id))
  return getAnnouncement(id)
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(
  query: NotificationListQuery,
  actor: CommunicationActor,
): Promise<Paginated<Notification>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    eq(notifications.userId, actor.userId),
    query.status ? eq(notifications.status, query.status) : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(
        ilike(notifications.title, pattern),
        ilike(notifications.body, pattern),
      )!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select()
    .from(notifications)
    .where(filter)
    .orderBy(desc(notifications.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return {
    data: toJsonList<Notification>(rows),
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function markNotificationRead(
  id: string,
  actor: CommunicationActor,
): Promise<Notification> {
  const client = await db()
  const [row] = await client
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Notification not found.')
  if (row.userId !== actor.userId) throw smsNotFound('Notification not found.')

  if (row.status === 'read') return toJsonModel<Notification>(row)
  const [updated] = await client
    .update(notifications)
    .set({ status: 'read', readAt: new Date().toISOString() })
    .where(eq(notifications.id, id))
    .returning()
  return toJsonModel<Notification>(updated!)
}

export async function markAllNotificationsRead(
  actor: CommunicationActor,
): Promise<{ updated: number }> {
  const client = await db()
  const result = await client
    .update(notifications)
    .set({ status: 'read', readAt: new Date().toISOString() })
    .where(
      and(
        eq(notifications.userId, actor.userId),
        eq(notifications.status, 'unread'),
      ),
    )
    .returning({ id: notifications.id })
  return { updated: result.length }
}

export async function deleteNotification(
  id: string,
  actor: CommunicationActor,
): Promise<void> {
  const client = await db()
  const [row] = await client
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Notification not found.')
  if (row.userId !== actor.userId) throw smsNotFound('Notification not found.')
  await client.delete(notifications).where(eq(notifications.id, id))
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

type MessageRow = typeof messages.$inferSelect

async function messageOrThrow(
  client: SmsDb,
  id: string,
): Promise<MessageRow> {
  const [row] = await client
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Message not found.')
  return row
}

export async function listMessages(
  query: MessageListQuery,
  actor: CommunicationActor,
): Promise<Paginated<MessageListItem>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    or(
      eq(messages.recipientId, actor.userId),
      eq(messages.senderId, actor.userId),
    )!,
    query.isRead !== undefined
      ? eq(messages.isRead, query.isRead)
      : undefined,
    query.direction
      ? eq(messages.direction, query.direction)
      : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(
        ilike(messages.subject, pattern),
        ilike(messages.body, pattern),
      )!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select({
      message: messages,
      senderName: users.name,
      senderEmail: users.email,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(filter)
    .orderBy(desc(messages.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  // Fetch recipient names in a second pass (recipient is always the
  // authenticated user or another user; join would need two user joins).
  const recipientIds = [
    ...new Set(rows.map((r) => r.message.recipientId)),
  ]
  const recipientMap = new Map<string, { name: string; email: string }>()
  if (recipientIds.length) {
    const recRows = await client
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        // drizzle inArray would work but for a single user it's simpler
        sql`${users.id} = ANY (${sql`ARRAY[${sql.join(recipientIds.map((id) => sql`${id}`), sql`, `)}]::uuid[]`})`,
      )
    for (const r of recRows) {
      recipientMap.set(r.id, { name: r.name, email: r.email })
    }
  }

  const data: MessageListItem[] = rows.map((r) => ({
    ...toJsonModel<Message>(r.message),
    senderName: r.senderName ?? null,
    senderEmail: r.senderEmail ?? null,
    recipientName: recipientMap.get(r.message.recipientId)?.name ?? null,
    recipientEmail: recipientMap.get(r.message.recipientId)?.email ?? null,
  }))

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getMessage(
  id: string,
  actor: CommunicationActor,
): Promise<MessageListItem> {
  const client = await db()
  const [row] = await client
    .select({
      message: messages,
      senderName: users.name,
      senderEmail: users.email,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Message not found.')
  const msg = row.message
  if (msg.recipientId !== actor.userId && msg.senderId !== actor.userId) {
    throw smsNotFound('Message not found.')
  }

  // Fetch recipient info.
  const [rec] = await client
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, msg.recipientId))
    .limit(1)

  return {
    ...toJsonModel<Message>(msg),
    senderName: row.senderName ?? null,
    senderEmail: row.senderEmail ?? null,
    recipientName: rec?.name ?? null,
    recipientEmail: rec?.email ?? null,
  }
}

export async function sendMessage(
  input: MessageCreate,
  actor: CommunicationActor,
): Promise<MessageListItem> {
  const client = await db()

  // Resolve recipient: prefer recipientId, else look up by email.
  let recipientId = input.recipientId
  if (!recipientId && input.recipientEmail) {
    const [user] = await client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.recipientEmail))
      .limit(1)
    if (!user) {
      throw smsFieldError('recipientEmail', 'User not found.')
    }
    recipientId = user.id
  }
  if (!recipientId) {
    throw smsFieldError('recipientId', 'Recipient is required.')
  }

  const [row] = await client
    .insert(messages)
    .values({
      senderId: actor.userId,
      recipientId,
      direction: 'outbound',
      subject: input.subject ?? null,
      body: input.body,
    })
    .returning()

  return getMessage(row!.id, actor)
}

export async function markMessageRead(
  id: string,
  actor: CommunicationActor,
): Promise<Message> {
  const client = await db()
  const row = await messageOrThrow(client, id)
  if (row.recipientId !== actor.userId) {
    throw smsNotFound('Message not found.')
  }
  if (row.isRead) return toJsonModel<Message>(row)
  const [updated] = await client
    .update(messages)
    .set({ isRead: true, readAt: new Date().toISOString() })
    .where(eq(messages.id, id))
    .returning()
  return toJsonModel<Message>(updated!)
}
