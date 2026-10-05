/**
 * Public website domain service (Phase 18A).
 *
 * Aggregates safe, non-personal counts for the unauthenticated homepage
 * statistics strip. The result is KV-cached (non-authoritative, short
 * TTL) because it is read on every public homepage render but changes
 * slowly; a cache miss falls through to D1.
 *
 * Everything here is an aggregate count — never a row, never PII.
 */
import type { H3Event } from 'h3'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { classes, students, subjects, teachers } from '../../database/schema'
import { publicStatsSchema } from '../../shared/schemas'
import type { PublicStats } from '../../shared/types'
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
