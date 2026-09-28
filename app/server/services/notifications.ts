/**
 * Phase 17B: per-user notification preferences and newsletter subscriptions.
 *
 * Preferences are keyed by `user_id` (one row per user, created lazily on
 * first update). Newsletter subscriptions are independent of portal accounts
 * — any email can subscribe (public form on the Phase 18 website).
 */
import { eq, sql } from 'drizzle-orm'
import {
  userNotificationPreferences,
  newsletterSubscriptions,
} from '../../database/schema'
import type { SmsDb } from '../utils/pagination'
import type {
  NotificationPreferences,
  NewsletterSubscriptionResult,
  NewsletterSubscriptionRow,
} from '../../shared/types'
import type {
  NotificationPreferenceUpdate,
  NewsletterSubscribe,
  NewsletterListQuery,
} from '../../shared/schemas/notifications'
import { smsNotFound } from '../utils/http-errors'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

/** Returns the preferences row for a user, or the defaults if none exists. */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const client = await db()
  const [row] = await client
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1)
  if (!row) {
    return {
      announcementEmail: true,
      feeReminderEmail: true,
      resultPublishedEmail: true,
      paymentReceiptEmail: true,
      urgentSms: true,
      updatedAt: null,
    }
  }
  return {
    announcementEmail: row.announcementEmail,
    feeReminderEmail: row.feeReminderEmail,
    resultPublishedEmail: row.resultPublishedEmail,
    paymentReceiptEmail: row.paymentReceiptEmail,
    urgentSms: row.urgentSms,
    updatedAt: row.updatedAt,
  }
}

/** Upserts the preferences row for a user. Returns the updated row. */
export async function updateNotificationPreferences(
  userId: string,
  input: NotificationPreferenceUpdate,
): Promise<NotificationPreferences> {
  const client = await db()
  const now = new Date().toISOString()

  // Build the SET clause from the provided fields only.
  const updates: Partial<typeof userNotificationPreferences.$inferInsert> = {
    updatedAt: now,
  }
  if (input.announcementEmail !== undefined) {
    updates.announcementEmail = input.announcementEmail
  }
  if (input.feeReminderEmail !== undefined) {
    updates.feeReminderEmail = input.feeReminderEmail
  }
  if (input.resultPublishedEmail !== undefined) {
    updates.resultPublishedEmail = input.resultPublishedEmail
  }
  if (input.paymentReceiptEmail !== undefined) {
    updates.paymentReceiptEmail = input.paymentReceiptEmail
  }
  if (input.urgentSms !== undefined) {
    updates.urgentSms = input.urgentSms
  }

  await client
    .insert(userNotificationPreferences)
    .values({ userId, ...updates })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: updates,
    })

  return getNotificationPreferences(userId)
}

// ---------------------------------------------------------------------------
// Newsletter subscriptions
// ---------------------------------------------------------------------------

/**
 * Idempotently subscribes an email address. If the email already exists,
 * re-subscribes (sets status back to 'subscribed'). Returns the current
 * state. No error on duplicate — the operation is idempotent.
 */
export async function subscribeNewsletter(
  input: NewsletterSubscribe,
): Promise<NewsletterSubscriptionResult> {
  const client = await db()
  const now = new Date().toISOString()
  const email = input.email.toLowerCase().trim()

  const [existing] = await client
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email))
    .limit(1)

  if (existing) {
    if (existing.status === 'subscribed') {
      // Already subscribed — no-op.
      return {
        email: existing.email,
        status: 'subscribed',
        subscribedAt: existing.subscribedAt,
      }
    }
    // Re-subscribe.
    await client
      .update(newsletterSubscriptions)
      .set({
        status: 'subscribed',
        name: input.name ?? existing.name,
        subscribedAt: now,
        unsubscribedAt: null,
        updatedAt: now,
      })
      .where(eq(newsletterSubscriptions.id, existing.id))
    return {
      email,
      status: 'subscribed',
      subscribedAt: now,
    }
  }

  await client.insert(newsletterSubscriptions).values({
    email,
    name: input.name ?? null,
    status: 'subscribed',
    subscribedAt: now,
  })
  return { email, status: 'subscribed', subscribedAt: now }
}

/**
 * Unsubscribes an email address. Idempotent — already-unsubscribed is a
 * no-op. Throws 404 if the email was never subscribed.
 */
export async function unsubscribeNewsletter(
  email: string,
): Promise<NewsletterSubscriptionResult> {
  const client = await db()
  const now = new Date().toISOString()
  const normalized = email.toLowerCase().trim()

  const [existing] = await client
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, normalized))
    .limit(1)

  if (!existing) {
    throw smsNotFound('Email address not found in the newsletter list.')
  }
  if (existing.status === 'unsubscribed') {
    return {
      email: existing.email,
      status: 'unsubscribed',
      subscribedAt: existing.subscribedAt,
    }
  }

  await client
    .update(newsletterSubscriptions)
    .set({
      status: 'unsubscribed',
      unsubscribedAt: now,
      updatedAt: now,
    })
    .where(eq(newsletterSubscriptions.id, existing.id))

  return {
    email: normalized,
    status: 'unsubscribed',
    subscribedAt: existing.subscribedAt,
  }
}

/**
 * Admin list of newsletter subscriptions with optional status filter.
 */
export async function listNewsletterSubscriptions(
  query: NewsletterListQuery,
): Promise<{ data: NewsletterSubscriptionRow[]; total: number }> {
  const client = await db()

  const where = query.status
    ? eq(newsletterSubscriptions.status, query.status)
    : undefined

  const [countRow] = await client
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(newsletterSubscriptions)
    .where(where)
  const total = Number(countRow?.count ?? 0)

  const rows = await client
    .select()
    .from(newsletterSubscriptions)
    .where(where)
    .orderBy(sql`${newsletterSubscriptions.createdAt} DESC`)
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return {
    data: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status,
      subscribedAt: r.subscribedAt,
      unsubscribedAt: r.unsubscribedAt,
      createdAt: r.createdAt,
    })),
    total,
  }
}
