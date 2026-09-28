/**
 * Phase 17: external notification delivery tracking, per-user notification
 * preferences, and newsletter subscriptions.
 *
 * `notification_deliveries` logs every email/SMS attempt (one row per
 * channel per notification). `user_notification_preferences` stores
 * opt-in/opt-out flags per event type. `newsletter_subscriptions` is a
 * public list independent of portal accounts (used by Phase 18 website).
 */
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { users } from './core'
import { notifications } from './communication'
import {
  deliveryChannelEnum,
  deliveryStatusEnum,
  deliveryProviderEnum,
  subscriptionStatusEnum,
} from './enums'

// ---------------------------------------------------------------------------
// Notification delivery log — one row per external channel attempt
// ---------------------------------------------------------------------------
export const notificationDeliveries = sqliteTable(
  'notification_deliveries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Nullable: standalone sends (e.g. test email) have no linked in-app row.
    notificationId: text('notification_id').references(
      () => notifications.id,
      { onDelete: 'set null' },
    ),
    channel: deliveryChannelEnum('channel').notNull(),
    recipientAddress: text('recipient_address').notNull(), // email or phone
    provider: deliveryProviderEnum('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    status: deliveryStatusEnum('status').default('pending').notNull(),
    sentAt: text('sent_at'),
    errorMessage: text('error_message'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    notificationChannelIdx: index(
      'notification_deliveries_notification_channel_idx',
    ).on(t.notificationId, t.channel),
    recipientCreatedIdx: index(
      'notification_deliveries_recipient_created_idx',
    ).on(t.recipientAddress, t.createdAt),
  }),
)

// ---------------------------------------------------------------------------
// Per-user notification preferences
// ---------------------------------------------------------------------------
export const userNotificationPreferences = sqliteTable(
  'user_notification_preferences',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    announcementEmail: integer('announcement_email', { mode: 'boolean' })
      .default(true)
      .notNull(),
    feeReminderEmail: integer('fee_reminder_email', { mode: 'boolean' })
      .default(true)
      .notNull(),
    resultPublishedEmail: integer('result_published_email', {
      mode: 'boolean',
    })
      .default(true)
      .notNull(),
    paymentReceiptEmail: integer('payment_receipt_email', { mode: 'boolean' })
      .default(true)
      .notNull(),
    urgentSms: integer('urgent_sms', { mode: 'boolean' })
      .default(true)
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
)

// ---------------------------------------------------------------------------
// Newsletter subscriptions (public, independent of portal accounts)
// ---------------------------------------------------------------------------
export const newsletterSubscriptions = sqliteTable(
  'newsletter_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    name: text('name'),
    status: subscriptionStatusEnum('status').default('subscribed').notNull(),
    subscribedAt: text('subscribed_at'),
    unsubscribedAt: text('unsubscribed_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('newsletter_subscriptions_email_idx').on(t.email),
  }),
)
