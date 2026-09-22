import { defineConfig } from 'drizzle-kit'

/**
 * Legacy Drizzle configuration for the PostgreSQL fallback path.
 *
 * Phase 1 of the D1 migration (2026-09-22) declared the D1 binding
 * `DB` alongside the live Hyperdrive binding in `wrangler.toml`. The
 * default `drizzle.config.ts` was switched to the SQLite dialect in
 * Phase 2 because D1 is now authoritative per the v2.0 spec.
 *
 * This file preserves the ability to generate/migrate against the
 * legacy Neon/Postgres staging database while the D1 schema rewrite
 * (Phase 2) and query-dialect migration (Phase 3) settle. It is removed
 * in Phase 6 once D1 staging passes acceptance.
 *
 * Run via the `--config` flag, e.g. `npm run db:pg:generate`. The
 * primary `app/database/schema` is now SQLite, so regenerating PG
 * migrations from it would fail; this config is retained for the
 * already-archived migrations under `database/migrations/legacy-pg/`
 * and for emergency edits to the live PG staging schema only.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './database/schema/index.ts',
  out: './database/migrations/legacy-pg',
  dbCredentials: {
    url: process.env.DATABASE_URL
      || 'postgresql://sms:sms_secret@localhost:5432/sms',
  },
  verbose: true,
  strict: true,
})
