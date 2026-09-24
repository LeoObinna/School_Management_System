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
import { getPlatformProxy } from 'wrangler'
import { drizzle } from 'drizzle-orm/d1'
import { schema } from './schema'
import { seedDatabase } from './seeds'

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
    console.log('D1 seed complete.')
  } finally {
    await proxy.dispose()
  }
}

main().catch((error) => {
  console.error('D1 seed failed:', error)
  process.exitCode = 1
})
