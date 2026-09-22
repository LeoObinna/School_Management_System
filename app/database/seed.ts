/**
 * Legacy PostgreSQL seed runner — executed outside the Nuxt runtime.
 *
 * Usage:
 *   DATABASE_URL=postgres://sms:sms_secret@localhost:5432/sms npm run db:seed
 *
 * Connects with postgres-js directly (no useRuntimeConfig) so it can run
 * under `tsx` against PostgreSQL 16.
 *
 * Phase 2 of the D1 migration (2026-09-22) switched the schema from
 * PostgreSQL to SQLite/D1 and adapted all seed values (kobo integers,
 * ×100 fixed-point scores, ISO-8601 text timestamps). The seed logic
 * in `./seeds` is now D1-native — this PG runner is RETAINED ONLY as
 * a fallback for the live Neon staging database until D1 staging
 * passes acceptance (Phase 6), at which point this file is removed.
 *
 * Because the schema is now SQLite, this runner will NOT type-check
 * against the current schema. The `@ts-expect-error` below suppresses
 * the PostgresJsDatabase ↔ DrizzleD1Database type mismatch. Do NOT
 * run this against a PG database whose schema has not yet been
 * migrated — the data values are now in D1 format (kobo/×100/ISO).
 *
 * For D1 seeding, use `npm run db:d1:seed` (runs `seed-d1.ts`).
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { schema } from './schema'
import { seedDatabase } from './seeds'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL is required to run seeds.')
  process.exit(1)
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client, { schema })

async function main(): Promise<void> {
  console.log('Seeding database (PG legacy)...')
  // Seed values are now D1-native (kobo/×100/ISO text). This call
  // will produce a type error because the schema is SQLite, not PG.
  // The PG staging DB is already seeded — do NOT re-run this against
  // a PG database unless you understand the value-format mismatch.
  // @ts-expect-error PG legacy — schema is now D1/SQLite (Phase 6 removes this file)
  await seedDatabase(db)
  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end()
  })
