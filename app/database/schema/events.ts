/**
 * Events and gallery tables (README §22).
 *
 * Images are stored in R2; metadata is in PostgreSQL. Thumbnail and
 * image optimization can be processed asynchronously via Queues.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  bigint,
  boolean,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { audienceEnum } from './enums'

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: varchar('location', { length: 255 }),
    audience: audienceEnum('audience').default('all').notNull(),
    status: varchar('status', { length: 20 }).default('published').notNull(),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    startsIdx: index('events_starts_idx').on(t.startsAt),
  }),
)

// ---------------------------------------------------------------------------
// Gallery albums
// ---------------------------------------------------------------------------
export const galleryAlbums = pgTable('gallery_albums', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  coverObjectKey: text('cover_object_key'),
  eventId: uuid('event_id'),
  isPublished: boolean('is_published').default(true).notNull(),
  createdById: uuid('created_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Gallery images (R2 metadata)
// ---------------------------------------------------------------------------
export const galleryImages = pgTable(
  'gallery_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    albumId: uuid('album_id')
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    thumbObjectKey: text('thumb_object_key'),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 150 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    caption: varchar('caption', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    albumIdx: index('gallery_images_album_idx').on(t.albumId),
  }),
)
