import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle ORM configuration for the SMS Cloudflare D1 (SQLite) database.
 *
 * The schema files in `./database/schema` use `sqliteTable`/`text`/
 * `integer` and Drizzle's SQLite core.
 *
 * drizzle-kit only GENERATES the SQL DDL from the TypeScript schema.
 * Migrations are APPLIED with `wrangler d1 migrations apply DB --local`
 * (or `--remote --env staging|production`), NOT `drizzle-kit migrate`,
 * so D1's binding-managed local/remote databases stay in sync without
 * any direct connection string. See `npm run db:migrate`.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './database/schema/index.ts',
  out: './database/migrations',
  verbose: true,
  strict: true,
})
