import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle ORM configuration for the SMS PostgreSQL database.
 *
 * Connection is read from DATABASE_URL (Codespace Secrets / env).
 * Migrations are generated into database/migrations and applied with
 * `npm run db:migrate`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './database/schema/index.ts',
  out: './database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://sms:sms_secret@localhost:5432/sms',
  },
  verbose: true,
  strict: true,
})
