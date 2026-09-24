/**
 * School settings domain service (Phase 14A; KV-cached in Phase 12).
 *
 * Settings live in the `school_settings` key/value table (schema/core.ts).
 * This module owns the mapping between DB keys and the typed
 * `SchoolSettings` object, provides defaults, and upserts changed keys
 * atomically.
 *
 * Two read paths:
 * - {@link getSchoolSettings}: full object (admin)
 * - {@link getPublicSchoolSettings}: branding/identity subset (any auth user)
 *
 * Both reads flow through a single KV cache entry (TRD §12 + §16) —
 * settings change rarely but are read on every authenticated page, so a
 * 60-second TTL with write-through invalidation cuts D1 reads without
 * introducing perceptible staleness. KV is non-authoritative; a miss
 * transparently falls through to D1, and unbound environments (plain
 * `nuxt dev`) bypass the cache entirely.
 */
import type { H3Event } from 'h3'
import { inArray } from 'drizzle-orm'
import { schoolSettings } from '../../database/schema'
import type { SchoolSettings } from '../../shared/types'
import {
  schoolSettingsSchema,
  schoolPublicSettingsSchema,
  type SchoolSettingsUpdate,
  type SchoolPublicSettings,
} from '../../shared/schemas'
import type { SmsDb } from '../utils/pagination'
import { cacheKey, getOrSet, invalidate } from '../utils/cache'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

/** Single cache entry; the public subset derives from the cached full. */
const SETTINGS_CACHE_KEY = cacheKey('school', 'settings')
const SETTINGS_CACHE_TTL = 60

/**
 * Maps the typed settings object to/from the `school.<field>` DB keys
 * used by the seed. Adding a setting means extending this map and the
 * zod schema together.
 */
const FIELD_TO_KEY: Record<keyof SchoolSettings, string> = {
  name: 'school.name',
  motto: 'school.motto',
  address: 'school.address',
  email: 'school.email',
  phone: 'school.phone',
  logoKey: 'school.logo_key',
  primaryColor: 'school.primary_color',
  secondaryColor: 'school.secondary_color',
  currency: 'school.currency',
  bankName: 'school.bank_name',
  accountName: 'school.account_name',
  accountNumber: 'school.account_number',
  academicYearStartMonth: 'school.academic_year_start_month',
}

const KEY_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_KEY).map(([field, key]) => [key, field]),
) as Record<string, keyof SchoolSettings>

const ALL_KEYS = Object.values(FIELD_TO_KEY)

/** Default values returned when a key is absent in the database. */
const DEFAULTS: SchoolSettings = {
  name: 'Victorious Children School',
  motto: '',
  address: '',
  email: '',
  phone: '',
  logoKey: '',
  primaryColor: '#1a237e',
  secondaryColor: '#1a1a2e',
  currency: 'NGN',
  bankName: '',
  accountName: '',
  accountNumber: '',
  academicYearStartMonth: 9,
}

/** Fields visible to any authenticated user (no bank/finance/academic). */
const PUBLIC_FIELDS: (keyof SchoolPublicSettings)[] = [
  'name',
  'motto',
  'address',
  'email',
  'phone',
  'logoKey',
  'primaryColor',
  'secondaryColor',
]

/** Coerces a stored value string into the typed field value. */
function coerce(field: keyof SchoolSettings, value: string | null): unknown {
  if (value === null || value === '') {
    return field === 'academicYearStartMonth' ? null : ''
  }
  if (field === 'academicYearStartMonth') {
    const n = Number(value)
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
  }
  return value
}

/**
 * Reads all known keys, returns the merged typed settings object.
 * Cached in KV for {@link SETTINGS_CACHE_TTL} seconds; a miss falls
 * through to D1. The cache is best-effort and non-authoritative.
 */
export async function getSchoolSettings(event: H3Event): Promise<SchoolSettings> {
  return getOrSet(event, SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL, () =>
    loadSchoolSettingsFromDb(),
  )
}

/** Loads settings from D1 (cache miss path). Exposed for tests. */
async function loadSchoolSettingsFromDb(): Promise<SchoolSettings> {
  const client = await db()
  const rows = await client
    .select({ key: schoolSettings.key, value: schoolSettings.value })
    .from(schoolSettings)
    .where(inArray(schoolSettings.key, ALL_KEYS))

  const result = { ...DEFAULTS } as Record<string, unknown>
  for (const row of rows) {
    const field = KEY_TO_FIELD[row.key]
    if (field) {
      result[field] = coerce(field, row.value)
    }
  }
  return schoolSettingsSchema.parse(result) as SchoolSettings
}

/** Public branding/identity subset for any authenticated user. */
export async function getPublicSchoolSettings(
  event: H3Event,
): Promise<SchoolPublicSettings> {
  const all = await getSchoolSettings(event)
  const subset: Record<string, unknown> = {}
  for (const field of PUBLIC_FIELDS) {
    subset[field] = all[field]
  }
  return schoolPublicSettingsSchema.parse(subset) as SchoolPublicSettings
}

/**
 * Applies a partial update. Only keys present in `patch` are written
 * (upsert). Invalidates the cache (best-effort) so the next read sees
 * fresh data. Returns the merged full settings after the update.
 */
export async function updateSchoolSettings(
  event: H3Event,
  patch: SchoolSettingsUpdate,
): Promise<SchoolSettings> {
  const client = await db()
  const now = new Date().toISOString()

  for (const [field, value] of Object.entries(patch) as [
    keyof SchoolSettings,
    unknown,
  ][]) {
    const key = FIELD_TO_KEY[field]
    if (!key) continue
    const stored =
      value === null || value === undefined || value === ''
        ? ''
        : String(value)
    await client
      .insert(schoolSettings)
      .values({
        key,
        value: stored,
        type: field === 'academicYearStartMonth' ? 'number' : 'string',
        group: groupFor(field),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schoolSettings.key,
        set: { value: stored, updatedAt: now },
      })
  }

  // Write-through invalidation: next read repopulates from D1. Best-effort;
  // a transient KV outage leaves at most `SETTINGS_CACHE_TTL` seconds of
  // staleness, which the outer 60s TTL bounds.
  await invalidate(event, SETTINGS_CACHE_KEY)
  return getSchoolSettings(event)
}

/** Derives the settings `group` for a field (matches seed conventions). */
function groupFor(field: keyof SchoolSettings): string {
  if (
    field === 'currency' ||
    field === 'bankName' ||
    field === 'accountName' ||
    field === 'accountNumber'
  ) {
    return 'finance'
  }
  if (field === 'academicYearStartMonth') {
    return 'academics'
  }
  if (
    field === 'logoKey' ||
    field === 'primaryColor' ||
    field === 'secondaryColor'
  ) {
    return 'branding'
  }
  return 'general'
}
