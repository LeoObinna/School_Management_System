/**
 * Communication tables (README §21) and learning resources (§17).
 *
 * Announcements support draft/scheduled/published/archived and audience
 * targeting. Bulk notification/email dispatch is handled by Cloudflare
 * Queues; notifications rows record per-recipient state.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `uuid` → `text` IDs, `varchar` → `text`, `timestamp` →
 * text ISO-8601, `boolean` → integer 0/1. The partial unique index on
 * notifications (announcement_id IS NOT NULL) is preserved — SQLite
 * supports partial indexes via `WHERE` clause in DDL.
 */
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './core'
import { teachers } from './people'
import { classes, subjects } from './academics'
import {
  publicationStatusEnum,
  audienceEnum,
  notificationStatusEnum,
  messageDirectionEnum,
} from './enums'

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    body: text('body'),
    audience: audienceEnum('audience').default('all').notNull(),
    classId: text('class_id').references(() => classes.id, {
      onDelete: 'set null',
    }), // optional targeting
    status: publicationStatusEnum('status').default('draft').notNull(),
    // Future publish instant for status='scheduled'. The every-5-minute
    // Cron Task publishes due rows (Phase 13); null for draft/published.
    scheduledFor: text('scheduled_for'),
    authorId: text('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: text('published_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    statusIdx: index('announcements_status_idx').on(t.status, t.publishedAt),
  }),
)

// ---------------------------------------------------------------------------
// Notifications (per recipient)
// ---------------------------------------------------------------------------
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    status: notificationStatusEnum('status').default('unread').notNull(),
    readAt: text('read_at'),
    // Correlation id for announcement fan-out (Phase 12 Part B). Set on
    // notifications produced by the async queue consumer; together with
    // the partial unique index it makes at-least-once delivery
    // idempotent (retries cannot create duplicate rows). Null for
    // notification types without an announcement.
    announcementId: text('announcement_id').references(
      () => announcements.id,
      { onDelete: 'cascade' },
    ),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.status),
    // Idempotency for queue-driven announcement fan-out (partial
    // unique index — SQLite supports `CREATE UNIQUE INDEX ... WHERE`).
    announcementIdempotencyIdx: uniqueIndex(
      'notifications_user_announcement_idx',
    )
      .on(t.userId, t.announcementId)
      .where(sql`announcement_id IS NOT NULL`),
  }),
)

// ---------------------------------------------------------------------------
// Messages (controlled internal messaging)
// ---------------------------------------------------------------------------
export const messages = sqliteTable(
  'messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    senderId: text('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    direction: messageDirectionEnum('direction')
      .default('outbound')
      .notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
    readAt: text('read_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    recipientIdx: index('messages_recipient_idx').on(
      t.recipientId,
      t.isRead,
    ),
    senderIdx: index('messages_sender_idx').on(t.senderId),
  }),
)

// ---------------------------------------------------------------------------
// Learning resources (R2 object metadata)
// ---------------------------------------------------------------------------
export const learningResources = sqliteTable('learning_resources', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  classId: text('class_id').references(() => classes.id, {
    onDelete: 'set null',
  }),
  subjectId: text('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  uploadedById: text('uploaded_by_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  isPublished: integer('is_published', { mode: 'boolean' })
    .default(true)
    .notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
