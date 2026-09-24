# Database Strategy

## Cloudflare D1 (SQLite)

D1 is the **only database** in every environment (local, staging,
production). There is no external relational database and no connection
string; D1 is reached through the Workers runtime via the `DB` binding.

## Local development

The `DB` D1 binding is declared in `app/wrangler.toml` under
`[[d1_databases]]`. During `nuxt dev` it is reached through
`wrangler getPlatformProxy({ persist: true })`; state persists under
`.wrangler/state/v3/d1/`. Only synthetic/fake demo data is allowed.

Apply migrations and seed locally:

``` text
cd app
npm run db:migrate   # wrangler d1 migrations apply DB --local
npm run db:seed      # fake demo data via D1
```

## Remote (staging / production)

The same `DB` binding is reached through the Workers runtime in the
`sms-staging` and `sms-production` named environments. Apply schema
remotely with wrangler — the Workers runtime is the only path; no
direct database connection string is used:

``` text
cd app
npx wrangler d1 migrations apply DB -e staging --remote
npx wrangler d1 migrations apply DB -e production --remote
```

Release order: migrate target database → deploy Worker.

## Drizzle ORM

SQLite dialect. Schema in `app/database/schema/` uses `sqliteTable`,
`text`, and `integer`. drizzle-kit only **generates** DDL
(`npm run db:generate`); wrangler **applies** it
(`npm run db:migrate`). drizzle-kit `push`/`studio` cannot target a D1
binding and are not used.

## Data-type conventions

- **Money**: INTEGER kobo (naira × 100); never floating point.
- **Assessment scores**: INTEGER × 100 fixed-point.
- **Timestamps**: TEXT ISO-8601 UTC.
- **Dates**: TEXT `YYYY-MM-DD`.
- **Booleans**: INTEGER 0/1 (Drizzle `{ mode: 'boolean' }`).
- **UUIDs**: TEXT with `crypto.randomUUID()` runtime default.
- **Enums**: TEXT + CHECK constraint via the `sqliteEnum` factory in
  `schema/enums.ts`.

## Schema principles

- UUID primary keys; foreign keys on all relationships.
- Meaningful unique constraints/composite keys (e.g. enrollment identity).
- Index real query paths.
- Soft-delete only where domain-appropriate.
- Migrations are version-controlled SQL applied in order (README §40).

## D1 / SQLite limits

D1 caps bound variables at 100 per statement; bulk inserts are
chunked (see `database/seeds/index.ts` `chunkInserter`).

## Access inside the Worker

`server/utils/db.ts` builds one Drizzle client per isolate from the
`env.DB` binding (`server/plugins/cloudflare.ts`). In plain Node dev
(`npm run dev`) it reaches the same D1 binding through
`wrangler getPlatformProxy`.

## Backups

- **Dev**: disposable; fake data only.
- **Staging/prod**: Cloudflare D1 backups/restores via the dashboard or
  `wrangler d1 backup` as available.
