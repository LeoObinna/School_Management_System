/**
 * Events and gallery domain service (README §22, Phase 10).
 *
 * Events have a simple draft/published/cancelled lifecycle. Gallery
 * images are stored in R2 with metadata in PostgreSQL; the route
 * handler handles R2 byte transfer and calls service methods for DB
 * state. Thumbnails are deferred to Phase 12.
 */
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { SmsDb } from '../utils/pagination'
import { smsNotFound } from '../utils/http-errors'
import { toJsonList, toJsonModel } from '../utils/serialize'
import {
  events,
  galleryAlbums,
  galleryImages,
  users,
} from '../../database/schema'
import type {
  AlbumCreate,
  AlbumListQuery,
  AlbumUpdate,
  EventCreate,
  EventListQuery,
  EventUpdate,
} from '../../shared/schemas'
import type {
  GalleryAlbum,
  GalleryAlbumDetail,
  GalleryAlbumListItem,
  GalleryImage,
  Paginated,
  SchoolEvent,
  SchoolEventListItem,
} from '../../shared/types'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

export interface EventsActor {
  userId: string
}

// drizzle's and() is typed as SQL | undefined; collapse to SQL.
function all(conditions: Array<SQL | undefined>): SQL {
  return and(...conditions) ?? sql`true`
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type EventRow = typeof events.$inferSelect

async function eventOrThrow(client: SmsDb, id: string): Promise<EventRow> {
  const [row] = await client
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Event not found.')
  return row
}

export async function listEvents(
  query: EventListQuery,
): Promise<Paginated<SchoolEventListItem>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    query.status ? eq(events.status, query.status) : undefined,
    query.audience ? eq(events.audience, query.audience) : undefined,
    query.from ? sql`${events.startsAt} >= ${new Date(query.from)}` : undefined,
    query.to ? sql`${events.startsAt} <= ${new Date(query.to)}` : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(ilike(events.title, pattern), ilike(events.description, pattern))!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select({
      event: events,
      createdByName: users.name,
    })
    .from(events)
    .leftJoin(users, eq(events.createdById, users.id))
    .where(filter)
    .orderBy(asc(events.startsAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const data: SchoolEventListItem[] = rows.map((r) => ({
    ...toJsonModel<SchoolEvent>(r.event),
    createdByName: r.createdByName ?? null,
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

export async function getEvent(
  id: string,
): Promise<SchoolEventListItem> {
  const client = await db()
  const [row] = await client
    .select({
      event: events,
      createdByName: users.name,
    })
    .from(events)
    .leftJoin(users, eq(events.createdById, users.id))
    .where(eq(events.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Event not found.')
  return {
    ...toJsonModel<SchoolEvent>(row.event),
    createdByName: row.createdByName ?? null,
  }
}

export async function createEvent(
  input: EventCreate,
  actor: EventsActor,
): Promise<SchoolEventListItem> {
  const client = await db()
  const [row] = await client
    .insert(events)
    .values({
      title: input.title,
      description: input.description ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      location: input.location ?? null,
      audience: input.audience ?? 'all',
      status: input.status ?? 'published',
      createdById: actor.userId,
    })
    .returning()
  return getEvent(row!.id)
}

export async function updateEvent(
  id: string,
  input: EventUpdate,
): Promise<SchoolEventListItem> {
  const client = await db()
  await eventOrThrow(client, id)
  await client
    .update(events)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.startsAt !== undefined && { startsAt: new Date(input.startsAt) }),
      ...(input.endsAt !== undefined && {
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
  return getEvent(id)
}

export async function deleteEvent(id: string): Promise<void> {
  const client = await db()
  await eventOrThrow(client, id)
  await client.delete(events).where(eq(events.id, id))
}

// ---------------------------------------------------------------------------
// Gallery albums
// ---------------------------------------------------------------------------

type AlbumRow = typeof galleryAlbums.$inferSelect

async function albumOrThrow(client: SmsDb, id: string): Promise<AlbumRow> {
  const [row] = await client
    .select()
    .from(galleryAlbums)
    .where(eq(galleryAlbums.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Album not found.')
  return row
}

export async function listAlbums(
  query: AlbumListQuery,
): Promise<Paginated<GalleryAlbumListItem>> {
  const client = await db()
  const where: Array<SQL | undefined> = [
    query.eventId ? eq(galleryAlbums.eventId, query.eventId) : undefined,
    query.isPublished !== undefined
      ? eq(galleryAlbums.isPublished, query.isPublished)
      : undefined,
  ]
  if (query.search) {
    const pattern = `%${query.search.trim()}%`
    where.push(
      or(
        ilike(galleryAlbums.title, pattern),
        ilike(galleryAlbums.description, pattern),
      )!,
    )
  }
  const filter = all(where)

  const totalRows = await client
    .select({ n: sql<number>`count(*)::int` })
    .from(galleryAlbums)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select({
      album: galleryAlbums,
      eventName: events.title,
      imageCount: sql<number>`(
        SELECT count(*)::int FROM gallery_images
        WHERE gallery_images.album_id = ${galleryAlbums.id}
      )`,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(filter)
    .orderBy(desc(galleryAlbums.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const data: GalleryAlbumListItem[] = rows.map((r) => ({
    ...toJsonModel<GalleryAlbum>(r.album),
    imageCount: Number(r.imageCount) || 0,
    eventName: r.eventName ?? null,
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

export async function getAlbum(
  id: string,
): Promise<GalleryAlbumDetail> {
  const client = await db()
  const [row] = await client
    .select({
      album: galleryAlbums,
      eventName: events.title,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(eq(galleryAlbums.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Album not found.')

  const imageRows = await client
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.albumId, id))
    .orderBy(asc(galleryImages.createdAt))

  return {
    ...toJsonModel<GalleryAlbum>(row.album),
    images: toJsonList<GalleryImage>(imageRows),
    eventName: row.eventName ?? null,
  }
}

export async function createAlbum(
  input: AlbumCreate,
  actor: EventsActor,
): Promise<GalleryAlbumListItem> {
  const client = await db()
  const [row] = await client
    .insert(galleryAlbums)
    .values({
      title: input.title,
      description: input.description ?? null,
      eventId: input.eventId ?? null,
      isPublished: input.isPublished ?? true,
      createdById: actor.userId,
    })
    .returning()

  // Return as list item shape (with imageCount and eventName).
  const [listRow] = await client
    .select({
      album: galleryAlbums,
      eventName: events.title,
      imageCount: sql<number>`(
        SELECT count(*)::int FROM gallery_images
        WHERE gallery_images.album_id = ${galleryAlbums.id}
      )`,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(eq(galleryAlbums.id, row!.id))
    .limit(1)
  return {
    ...toJsonModel<GalleryAlbum>(listRow!.album),
    imageCount: Number(listRow!.imageCount) || 0,
    eventName: listRow!.eventName ?? null,
  }
}

export async function updateAlbum(
  id: string,
  input: AlbumUpdate,
): Promise<GalleryAlbumListItem> {
  const client = await db()
  await albumOrThrow(client, id)
  await client
    .update(galleryAlbums)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.eventId !== undefined && { eventId: input.eventId }),
      ...(input.isPublished !== undefined && {
        isPublished: input.isPublished,
      }),
      updatedAt: new Date(),
    })
    .where(eq(galleryAlbums.id, id))

  const [listRow] = await client
    .select({
      album: galleryAlbums,
      eventName: events.title,
      imageCount: sql<number>`(
        SELECT count(*)::int FROM gallery_images
        WHERE gallery_images.album_id = ${galleryAlbums.id}
      )`,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(eq(galleryAlbums.id, id))
    .limit(1)
  return {
    ...toJsonModel<GalleryAlbum>(listRow!.album),
    imageCount: Number(listRow!.imageCount) || 0,
    eventName: listRow!.eventName ?? null,
  }
}

export async function deleteAlbum(
  id: string,
): Promise<{ objectKeys: string[]; thumbObjectKeys: string[] }> {
  const client = await db()
  await albumOrThrow(client, id)
  const imageRows = await client
    .select({
      objectKey: galleryImages.objectKey,
      thumbObjectKey: galleryImages.thumbObjectKey,
    })
    .from(galleryImages)
    .where(eq(galleryImages.albumId, id))
  const objectKeys = imageRows.map((r) => r.objectKey)
  const thumbObjectKeys = imageRows
    .map((r) => r.thumbObjectKey)
    .filter((k): k is string => k !== null)
  await client.delete(galleryAlbums).where(eq(galleryAlbums.id, id))
  return { objectKeys, thumbObjectKeys }
}

// ---------------------------------------------------------------------------
// Gallery images
// ---------------------------------------------------------------------------

export interface StoredImageInput {
  objectKey: string
  thumbObjectKey?: string | null
  fileName: string
  mimeType: string
  sizeBytes: number
  caption?: string | null
}

export async function addImage(
  albumId: string,
  input: StoredImageInput,
): Promise<GalleryAlbumDetail> {
  const client = await db()
  await albumOrThrow(client, albumId)
  await client.insert(galleryImages).values({
    albumId,
    objectKey: input.objectKey,
    thumbObjectKey: input.thumbObjectKey ?? null,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    caption: input.caption ?? null,
  })
  return getAlbum(albumId)
}

/**
 * Records (or clears) the derived thumbnail object key for one image.
 * Used by the eager upload path and by lazy on-demand backfill.
 */
export async function setImageThumbObjectKey(
  imageId: string,
  thumbObjectKey: string | null,
): Promise<void> {
  const client = await db()
  await client
    .update(galleryImages)
    .set({ thumbObjectKey })
    .where(eq(galleryImages.id, imageId))
}

export async function getImageForDownload(
  albumId: string,
  imageId: string,
): Promise<GalleryImage> {
  const client = await db()
  const [row] = await client
    .select()
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.id, imageId),
        eq(galleryImages.albumId, albumId),
      ),
    )
    .limit(1)
  if (!row) throw smsNotFound('Image not found.')
  return toJsonModel<GalleryImage>(row)
}

export async function deleteImage(
  albumId: string,
  imageId: string,
): Promise<{
  detail: GalleryAlbumDetail
  objectKey: string
  thumbObjectKey: string | null
}> {
  const client = await db()
  const [row] = await client
    .select()
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.id, imageId),
        eq(galleryImages.albumId, albumId),
      ),
    )
    .limit(1)
  if (!row) throw smsNotFound('Image not found.')
  await client.delete(galleryImages).where(eq(galleryImages.id, imageId))
  const detail = await getAlbum(albumId)
  return {
    detail,
    objectKey: row.objectKey,
    thumbObjectKey: row.thumbObjectKey,
  }
}
