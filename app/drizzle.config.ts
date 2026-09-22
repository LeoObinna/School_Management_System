import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle ORM configuration for the SMS Cloudflare D1 (SQLite) database.
 *
 * Phase 2 of the D1 migration (2026-09-22) switched the dialect from
 * `postgresql` to `sqlite`. The schema files in `./database/schema` now
 * use `sqliteTable`/`text`/`integer` and Drizzle's SQLite core.
 *
 * drizzle-kit only GENERATES the SQL DDL from the TypeScript schema.
 * Migrations are APPLIED with `wrangler d1 migrations apply DB --local`
 * (or `--remote --env staging|production`), NOT `drizzle-kit migrate`,
 * so D1's binding-managed local/remote databases stay in sync without
 * any direct connection string. See `npm run db:d1:migrate`.
 *
 * The legacy PostgreSQL config that powered staging until 2026-09-22
 * lives in `drizzle.pg.config.ts` and points at the archived migrations
 * under `database/migrations/legacy-pg/`. It is kept only as a fallback
 * until D1 staging passes acceptance (Phase 6).
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './database/schema/index.ts',
  out: './database/migrations',
  verbose: true,
  strict: true,
})
