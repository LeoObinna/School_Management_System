/**
 * Communication tables (README §21) and learning resources (§17).
 *
 * Announcements support draft/scheduled/published/archived and audience
 * targeting. Bulk notification/email dispatch is handled by Cloudflare
 * Queues; notifications rows record per-recipient state.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  boolean,
  index,
} from 'drizzle-orm/pg-core'
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
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    audience: audienceEnum('audience').default('all').notNull(),
    classId: uuid('class_id').references(() => classes.id, {
      onDelete: 'set null',
    }), // optional targeting
    status: publicationStatusEnum('status').default('draft').notNull(),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    statusIdx: index('announcements_status_idx').on(t.status, t.publishedAt),
  }),
)

// ---------------------------------------------------------------------------
// Notifications (per recipient)
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    link: text('link'),
    status: notificationStatusEnum('status').default('unread').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.status),
  }),
)

// ---------------------------------------------------------------------------
// Messages (controlled internal messaging)
// ---------------------------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    direction: messageDirectionEnum('direction').default('outbound').notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
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
export const learningResources = pgTable('learning_resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  classId: uuid('class_id').references(() => classes.id, {
    onDelete: 'set null',
  }),
  subjectId: uuid('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  uploadedById: uuid('uploaded_by_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  objectKey: text('object_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 150 }),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
