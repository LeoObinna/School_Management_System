/**
 * Standalone D1 seed runner — executed outside the Nuxt runtime.
 *
 * Usage:
 *   npm run db:d1:seed
 *   npm run db:seed        (alias)
 *
 * Connects to the local D1 binding declared in `wrangler.toml` via
 * `wrangler`'s `getPlatformProxy` (Miniflare-backed local emulation,
 * state persisted under `.wrangler/state/v3/d1/`). Seeds idempotent
 * demo data (kobo integers, ×100 fixed-point scores, ISO-8601 text
 * timestamps).
 *
 * Requires the D1 migration to be applied first:
 *   npm run db:migrate
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { eq } from 'drizzle-orm'
import { getPlatformProxy } from 'wrangler'
import { drizzle } from 'drizzle-orm/d1'
import { schema, schoolSettings } from './schema'
import { seedDatabase, type DB } from './seeds'

/** Structural subset of the local R2 binding the seeder needs. */
interface SeedR2Bucket {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

const LOGO_OBJECT_KEY = 'school/logo/vcs-logo.jpeg'
const LOGO_ASSET_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'seed-assets',
  'vcs-logo.jpeg',
)

/**
 * Idempotently seeds the real school logo (Phase 14A) into local R2 and
 * points `school.logo_key` at it. Skipped when a logo key is already set
 * (e.g. an admin uploaded one), so re-runs never clobber a later change.
 * Local emulation only — production logo is set via the Settings UI.
 */
async function seedSchoolLogo(
  db: DB,
  bucket: SeedR2Bucket | undefined,
): Promise<void> {
  if (!bucket) {
    console.log('R2_BUCKET binding unavailable; skipping logo seed.')
    return
  }
  const rows = await db
    .select({ value: schoolSettings.value })
    .from(schoolSettings)
    .where(eq(schoolSettings.key, 'school.logo_key'))
  if (rows[0]?.value) {
    console.log('School logo already set; skipping logo seed.')
    return
  }

  const bytes = await readFile(LOGO_ASSET_PATH)
  await bucket.put(LOGO_OBJECT_KEY, bytes, {
    httpMetadata: { contentType: 'image/jpeg' },
  })
  const now = new Date().toISOString()
  await db
    .insert(schoolSettings)
    .values({
      key: 'school.logo_key',
      value: LOGO_OBJECT_KEY,
      type: 'string',
      group: 'branding',
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schoolSettings.key,
      set: { value: LOGO_OBJECT_KEY, updatedAt: now },
    })
  console.log(`School logo seeded to R2 (${LOGO_OBJECT_KEY}).`)
}

async function main(): Promise<void> {
  console.log('Seeding D1 database...')
  const proxy = await getPlatformProxy({
    configPath: './wrangler.toml',
    persist: true,
  })
  try {
    // getPlatformProxy types env generically; the real D1 binding is
    // structurally compatible with drizzle-orm/d1's expected D1Database.
    const db = drizzle(proxy.env.DB as never, { schema })
    await seedDatabase(db)
    await seedSchoolLogo(
      db,
      proxy.env.R2_BUCKET as SeedR2Bucket | undefined,
    )
    console.log('D1 seed complete.')
  } finally {
    await proxy.dispose()
  }
}

main().catch((error) => {
  console.error('D1 seed failed:', error)
  process.exitCode = 1
})
