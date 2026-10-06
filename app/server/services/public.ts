/**
 * Public website domain service (Phase 18A + 18B).
 *
 * 18A: aggregate stats for the homepage strip (KV-cached, short TTL).
 * 18B: content sections — news (published audience-all announcements),
 * events, gallery albums/images and the academics structure.
 *
 * Privacy model: SQL applies the publication/audience/isPublished gates
 * AND the mappers re-check them in JS before shaping the payload, so a
 * future query edit cannot silently widen what the public site exposes.
 * Payloads contain display fields only — never author ids, audiences,
 * statuses or storage object keys (images are referenced by their public
 * streaming route URL). Nothing here returns a person or PII.
 *
 * Caching: stats and academics are KV-cached (read on page renders,
 * change slowly). News/events/albums lists are not KV-cached — they are
 * cheap D1 queries and the routes carry public Cache-Control for the
 * edge; SSR renders call the services directly.
 */
import type { H3Event } from 'h3'
import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import {
  academicSessions,
  announcements,
  classes,
  classSubjects,
  events,
  galleryAlbums,
  galleryImages,
  students,
  subjects,
  teachers,
  terms,
} from '../../database/schema'
import {
  publicAcademicsSchema,
  publicAlbumDetailSchema,
  publicAlbumsListSchema,
  publicEventsListSchema,
  publicNewsListSchema,
  publicNewsItemSchema,
  publicStatsSchema,
  type PublicAlbumsListQuery,
  type PublicEventsListQuery,
  type PublicNewsListQuery,
} from '../../shared/schemas'
import type {
  GalleryImage,
  Paginated,
  PublicAcademics,
  PublicAlbum,
  PublicAlbumDetail,
  PublicEvent,
  PublicImage,
  PublicNewsItem,
  PublicStats,
} from '../../shared/types'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { cacheKey, getOrSet } from '../utils/cache'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

const STATS_CACHE_KEY = cacheKey('public', 'stats')
const STATS_CACHE_TTL = 300

/**
 * Homepage statistics: active students, active teachers, active classes,
 * active subjects. KV-cached for {@link STATS_CACHE_TTL} seconds.
 */
export async function getPublicStats(event: H3Event): Promise<PublicStats> {
  const stats = await getOrSet(event, STATS_CACHE_KEY, STATS_CACHE_TTL, () =>
    loadPublicStatsFromDb(),
  )
  return publicStatsSchema.parse(stats) as PublicStats
}

/** Loads the counts from D1 (cache miss path). Exposed for tests. */
async function loadPublicStatsFromDb(): Promise<PublicStats> {
  const client = await db()

  const [studentCount] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(students)
    .where(and(eq(students.status, 'active'), isNull(students.deletedAt)))

  const [teacherCount] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(teachers)
    .where(and(eq(teachers.isActive, true), isNull(teachers.deletedAt)))

  const [classCount] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(classes)
    .where(eq(classes.isActive, true))

  const [subjectCount] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(subjects)
    .where(eq(subjects.isActive, true))

  return {
    students: studentCount?.n ?? 0,
    teachers: teacherCount?.n ?? 0,
    classes: classCount?.n ?? 0,
    subjects: subjectCount?.n ?? 0,
  }
}

// ---------------------------------------------------------------------------
// 18B — News (published, audience-all announcements)
// ---------------------------------------------------------------------------

type PublicNewsRow = {
  id: string
  title: string
  body: string | null
  publishedAt: string | null
  status: string
  audience: string
}

const publicNewsColumns = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  publishedAt: announcements.publishedAt,
  status: announcements.status,
  audience: announcements.audience,
} as const

/** JS double-gate for the SQL filter — see the file header. */
function isPublicNewsRow(row: PublicNewsRow): boolean {
  return row.status === 'published' && row.audience === 'all'
}

function toPublicNewsItem(row: PublicNewsRow): PublicNewsItem {
  return { id: row.id, title: row.title, body: row.body, publishedAt: row.publishedAt }
}

function paginationMeta(total: number, page: number, perPage: number) {
  return {
    currentPage: page,
    perPage,
    total,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
  }
}

/** Published, audience-all announcements, newest first. */
export async function getPublicNews(
  query: PublicNewsListQuery,
): Promise<Paginated<PublicNewsItem>> {
  const client = await db()
  const gate = and(
    eq(announcements.status, 'published'),
    eq(announcements.audience, 'all'),
  )

  const [countRow] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(announcements)
    .where(gate)
  const total = Number(countRow?.n) || 0

  const rows = await client
    .select(publicNewsColumns)
    .from(announcements)
    .where(gate)
    .orderBy(desc(announcements.publishedAt), desc(announcements.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return publicNewsListSchema.parse({
    data: rows.filter(isPublicNewsRow).map(toPublicNewsItem),
    meta: paginationMeta(total, query.page, query.perPage),
  }) as Paginated<PublicNewsItem>
}

/** One news item; generic 404 unless published and audience-all. */
export async function getPublicNewsItem(id: string): Promise<PublicNewsItem> {
  const client = await db()
  const [row] = await client
    .select(publicNewsColumns)
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1)
  if (!row || !isPublicNewsRow(row)) throw smsNotFound('News item not found.')
  return publicNewsItemSchema.parse(toPublicNewsItem(row)) as PublicNewsItem
}

// ---------------------------------------------------------------------------
// 18B — Events (published, audience-all)
// ---------------------------------------------------------------------------

type PublicEventRow = {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
  status: string
  audience: string
}

const publicEventColumns = {
  id: events.id,
  title: events.title,
  description: events.description,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  status: events.status,
  audience: events.audience,
} as const

function isPublicEventRow(row: PublicEventRow): boolean {
  return row.status === 'published' && row.audience === 'all'
}

function toPublicEvent(row: PublicEventRow): PublicEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
  }
}

/**
 * Published, audience-all events. `upcoming` (default) lists events from
 * now onwards, soonest first; `past` lists earlier events, latest first.
 */
export async function getPublicEvents(
  query: PublicEventsListQuery,
): Promise<Paginated<PublicEvent>> {
  const client = await db()
  const now = new Date().toISOString()
  const gate = and(
    eq(events.status, 'published'),
    eq(events.audience, 'all'),
    query.when === 'past' ? lt(events.startsAt, now) : gte(events.startsAt, now),
  )

  const [countRow] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(events)
    .where(gate)
  const total = Number(countRow?.n) || 0

  const rows = await client
    .select(publicEventColumns)
    .from(events)
    .where(gate)
    .orderBy(query.when === 'past' ? desc(events.startsAt) : asc(events.startsAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return publicEventsListSchema.parse({
    data: rows.filter(isPublicEventRow).map(toPublicEvent),
    meta: paginationMeta(total, query.page, query.perPage),
  }) as Paginated<PublicEvent>
}

// ---------------------------------------------------------------------------
// 18B — Gallery (published albums only; images stream via route URLs)
// ---------------------------------------------------------------------------

/** Base of the public image streaming route (never an R2 object key). */
export const PUBLIC_IMAGE_BASE_URL = '/api/v1/public/gallery/images'

function publicImageUrls(imageId: string): { url: string; thumbUrl: string } {
  return {
    url: `${PUBLIC_IMAGE_BASE_URL}/${imageId}`,
    thumbUrl: `${PUBLIC_IMAGE_BASE_URL}/${imageId}?variant=thumb`,
  }
}

type PublicAlbumRow = {
  id: string
  title: string
  description: string | null
  coverObjectKey: string | null
  imageCount: number
  isPublished: boolean
  eventTitle: string | null
  eventStatus: string | null
}

type CoverCandidate = {
  albumId: string
  id: string
  objectKey: string
}

/**
 * Picks the cover image id for an album: the image matching
 * cover_object_key when set, otherwise the first image, otherwise null.
 */
function pickCoverImageId(
  album: { coverObjectKey: string | null; id: string },
  images: CoverCandidate[],
): string | null {
  const own = images.filter((img) => img.albumId === album.id)
  if (own.length === 0) return null
  if (album.coverObjectKey) {
    const match = own.find((img) => img.objectKey === album.coverObjectKey)
    if (match) return match.id
  }
  return own[0]!.id
}

function toPublicAlbum(
  row: PublicAlbumRow,
  images: CoverCandidate[],
): PublicAlbum {
  const coverId = pickCoverImageId(row, images)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageCount: row.imageCount,
    coverUrl: coverId ? `${publicImageUrls(coverId).url}?variant=thumb` : null,
    // The linked event's title is shown only when that event is published.
    eventTitle: row.eventStatus === 'published' ? row.eventTitle : null,
  }
}

/** Published albums, newest first, with image counts and cover URLs. */
export async function getPublicAlbums(
  query: PublicAlbumsListQuery,
): Promise<Paginated<PublicAlbum>> {
  const client = await db()
  const gate = eq(galleryAlbums.isPublished, true)

  const [countRow] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(galleryAlbums)
    .where(gate)
  const total = Number(countRow?.n) || 0

  const rows = await client
    .select({
      id: galleryAlbums.id,
      title: galleryAlbums.title,
      description: galleryAlbums.description,
      coverObjectKey: galleryAlbums.coverObjectKey,
      isPublished: galleryAlbums.isPublished,
      eventTitle: events.title,
      eventStatus: events.status,
      imageCount: sql<number>`(
        SELECT cast(count(*) as integer) FROM gallery_images
        WHERE gallery_images.album_id = ${galleryAlbums.id}
      )`,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(gate)
    .orderBy(desc(galleryAlbums.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const published = rows.filter((r) => r.isPublished)

  // One batched query resolves every cover candidate for the page.
  const albumIds = published.map((r) => r.id)
  const covers: CoverCandidate[] = albumIds.length
    ? await client
        .select({
          albumId: galleryImages.albumId,
          id: galleryImages.id,
          objectKey: galleryImages.objectKey,
        })
        .from(galleryImages)
        .where(
          sql`${galleryImages.albumId} IN (${sql.join(
            albumIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .orderBy(asc(galleryImages.createdAt))
    : []

  return publicAlbumsListSchema.parse({
    data: published.map((r) =>
      toPublicAlbum({ ...r, imageCount: Number(r.imageCount) || 0 }, covers),
    ),
    meta: paginationMeta(total, query.page, query.perPage),
  }) as Paginated<PublicAlbum>
}

/** One published album with its images; generic 404 otherwise. */
export async function getPublicAlbum(id: string): Promise<PublicAlbumDetail> {
  const client = await db()
  const [row] = await client
    .select({
      id: galleryAlbums.id,
      title: galleryAlbums.title,
      description: galleryAlbums.description,
      coverObjectKey: galleryAlbums.coverObjectKey,
      isPublished: galleryAlbums.isPublished,
      eventTitle: events.title,
      eventStatus: events.status,
    })
    .from(galleryAlbums)
    .leftJoin(events, eq(galleryAlbums.eventId, events.id))
    .where(eq(galleryAlbums.id, id))
    .limit(1)
  if (!row || !row.isPublished) throw smsNotFound('Album not found.')

  const imageRows = await client
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.albumId, id))
    .orderBy(asc(galleryImages.createdAt))

  const images: PublicImage[] = imageRows.map((img) => ({
    id: img.id,
    ...publicImageUrls(img.id),
    caption: img.caption,
    fileName: img.fileName,
  }))

  return publicAlbumDetailSchema.parse({
    ...toPublicAlbum({ ...row, imageCount: images.length }, imageRows),
    images,
  }) as PublicAlbumDetail
}

/**
 * Resolves an image for public streaming. Returns the full gallery image
 * row ONLY when the parent album is published — a generic 404 otherwise,
 * so unpublished content and nonexistent ids are indistinguishable.
 */
export async function getPublicImageForStream(
  imageId: string,
): Promise<GalleryImage> {
  const client = await db()
  const [row] = await client
    .select({
      image: galleryImages,
      albumPublished: galleryAlbums.isPublished,
    })
    .from(galleryImages)
    .innerJoin(galleryAlbums, eq(galleryImages.albumId, galleryAlbums.id))
    .where(eq(galleryImages.id, imageId))
    .limit(1)
  if (!row || !row.albumPublished) throw smsNotFound('Image not found.')
  return {
    id: row.image.id,
    albumId: row.image.albumId,
    objectKey: row.image.objectKey,
    thumbObjectKey: row.image.thumbObjectKey,
    fileName: row.image.fileName,
    mimeType: row.image.mimeType,
    sizeBytes: row.image.sizeBytes,
    caption: row.image.caption,
    createdAt: row.image.createdAt,
  }
}

// ---------------------------------------------------------------------------
// 18B — Academics (current session/terms + active class structure)
// ---------------------------------------------------------------------------

const ACADEMICS_CACHE_KEY = cacheKey('public', 'academics')
const ACADEMICS_CACHE_TTL = 300

/**
 * Current session + its active terms + active classes grouped by level
 * with their active subject names. KV-cached for
 * {@link ACADEMICS_CACHE_TTL} seconds. No people data.
 */
export async function getPublicAcademics(
  event: H3Event,
): Promise<PublicAcademics> {
  const payload = await getOrSet(
    event,
    ACADEMICS_CACHE_KEY,
    ACADEMICS_CACHE_TTL,
    () => loadPublicAcademicsFromDb(),
  )
  return publicAcademicsSchema.parse(payload) as PublicAcademics
}

/** Loads and shapes the academics payload from D1 (cache miss path). */
async function loadPublicAcademicsFromDb(): Promise<PublicAcademics> {
  const client = await db()

  const [sessionRow] = await client
    .select({
      name: academicSessions.name,
      startDate: academicSessions.startDate,
      endDate: academicSessions.endDate,
      id: academicSessions.id,
    })
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1)

  const termRows = sessionRow
    ? await client
        .select({
          name: terms.name,
          startDate: terms.startDate,
          endDate: terms.endDate,
          isCurrent: terms.isCurrent,
        })
        .from(terms)
        .where(and(eq(terms.sessionId, sessionRow.id), eq(terms.isActive, true)))
        .orderBy(asc(terms.sequence))
    : []

  const classRows = await client
    .select({
      id: classes.id,
      name: classes.name,
      level: classes.level,
      isActive: classes.isActive,
    })
    .from(classes)
    .orderBy(asc(classes.sequence), asc(classes.name))

  const linkRows = await client
    .select({
      classId: classSubjects.classId,
      subjectName: subjects.name,
      subjectActive: subjects.isActive,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .orderBy(asc(subjects.name))

  const subjectsByClass = new Map<string, string[]>()
  for (const link of linkRows) {
    if (!link.subjectActive) continue
    const list = subjectsByClass.get(link.classId) ?? []
    list.push(link.subjectName)
    subjectsByClass.set(link.classId, list)
  }

  // Group active classes by level, preserving sequence order; levels are
  // ordered by their first (earliest-sequenced) class. Classes without a
  // level group under a null name.
  const levelOrder: (string | null)[] = []
  const byLevel = new Map<
    string | null,
    { id: string; name: string; subjects: string[] }[]
  >()
  for (const klass of classRows) {
    if (!klass.isActive) continue
    const level = klass.level || null
    if (!byLevel.has(level)) {
      byLevel.set(level, [])
      levelOrder.push(level)
    }
    byLevel.get(level)!.push({
      id: klass.id,
      name: klass.name,
      subjects: subjectsByClass.get(klass.id) ?? [],
    })
  }

  return {
    session: sessionRow
      ? {
          name: sessionRow.name,
          startDate: sessionRow.startDate,
          endDate: sessionRow.endDate,
        }
      : null,
    terms: termRows,
    levels: levelOrder.map((name) => ({ name, classes: byLevel.get(name)! })),
  }
}
