/**
 * Standalone seed runner — executed outside the Nuxt runtime.
 *
 * Usage:
 *   DATABASE_URL=postgres://sms:sms_secret@localhost:5432/sms npm run db:seed
 *
 * Connects with postgres-js directly (no useRuntimeConfig) so it can run
 * under `tsx` in the Codespace against PostgreSQL 16.
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
  console.log('Seeding database...')
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
