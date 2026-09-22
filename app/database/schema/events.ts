/**
 * Events and gallery tables (README §22).
 *
 * Images are stored in R2; metadata is in D1/SQLite. Thumbnail and
 * image optimization can be processed asynchronously via Queues.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `uuid` → `text` IDs, `varchar` → `text`, `timestamp` →
 * text ISO-8601, `bigint` size_bytes → `integer` (SQLite INTEGER is
 * 64-bit, JS-safe up to 2^53), `boolean` → integer 0/1.
 */
import {
  sqliteTable,
  text,
  integer,
  index,
} from 'drizzle-orm/sqlite-core'
import { users } from './core'
import { audienceEnum } from './enums'

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const events = sqliteTable(
  'events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    location: text('location'),
    audience: audienceEnum('audience').default('all').notNull(),
    status: text('status').default('published').notNull(),
    createdById: text('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    startsIdx: index('events_starts_idx').on(t.startsAt),
  }),
)

// ---------------------------------------------------------------------------
// Gallery albums
// ---------------------------------------------------------------------------
export const galleryAlbums = sqliteTable('gallery_albums', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  coverObjectKey: text('cover_object_key'),
  eventId: text('event_id'),
  isPublished: integer('is_published', { mode: 'boolean' })
    .default(true)
    .notNull(),
  createdById: text('created_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ---------------------------------------------------------------------------
// Gallery images (R2 metadata)
// ---------------------------------------------------------------------------
export const galleryImages = sqliteTable(
  'gallery_images',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    albumId: text('album_id')
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    thumbObjectKey: text('thumb_object_key'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    caption: text('caption'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    albumIdx: index('gallery_images_album_idx').on(t.albumId),
  }),
)
