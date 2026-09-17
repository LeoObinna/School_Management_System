# Database Strategy

## PostgreSQL 16

PostgreSQL is the **source of truth** for all relational data. D1 is
not used. Evidence the current implementation requires real PostgreSQL:
52 Drizzle tables, 16 `pgEnum` types, 47 UUID primary keys, 20 `NUMERIC`
columns (money/scores), 80 index declarations, foreign keys and
service-layer transactions.

## Three separated environments

### 1. Development (local machine)

Local PostgreSQL via **Postgres.app** (verified server 16.15) with a
dedicated database `sms_dev`. Postgres.app uses trust auth on localhost
(no password). Create it once:

``` text
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb \
  -h localhost -p 5432 -U "$USER" sms_dev
```

The connection string is read by Nuxt/Drizzle from the gitignored
`app/.env`:

``` text
DATABASE_URL=postgresql://mac@127.0.0.1:5432/sms_dev
```

For Workers emulation (`npm run cf:dev` / `wrangler dev`) the same
database is reached via a locally emulated HYPERDRIVE binding declared
at the top of `app/wrangler.toml` with
`localConnectionString = "postgresql://mac:local@127.0.0.1:5432/sms_dev"`
(the dummy password is required by Wrangler URL validation; trust auth
ignores it). The top-level placeholder Hyperdrive `id` is never used
remotely and is never deployed — deploys always target the named
staging/production environments. R2 is emulated on local disk. Only
synthetic/fake demo data is allowed.

### 2. Staging

A dedicated managed PostgreSQL database/schema (`sms_staging`),
reachable from the `sms-staging` Worker through a dedicated Hyperdrive
config (`sms-pg-staging`). Never use the production database for
staging.

### 3. Production

A separate managed PostgreSQL database (`sms_production`) with its own
credentials, reached from the `sms-production` Worker through the
`sms-pg-production` Hyperdrive config. Production credentials are never
shared with development or staging, and never committed to Git.

## Migrations

- SQL lives in `app/database/migrations/` (Drizzle-generated).
- Apply from the local machine against the **direct** managed-PG URL —
  never through Hyperdrive:

``` text
cd app
DATABASE_URL=<direct-env-url> npm run db:migrate
DATABASE_URL=<direct-env-url> npm run db:seed   # fake demo data only
```

- Release order: migrate target database → deploy Worker.

## Access inside the Worker

`server/utils/db.ts` creates one Drizzle client per isolate from
`env.HYPERDRIVE.connectionString` (`server/plugins/cloudflare.ts`),
with `max: 1` because Hyperdrive pools at the edge. In plain Node dev
(`npm run dev`) it falls back to `DATABASE_URL`.

## Schema principles

- UUID primary keys; foreign keys on all relationships
- Meaningful unique constraints/composite keys (e.g. enrollment identity)
- Index real query paths
- `NUMERIC` for money/scores — never floating point
- Timestamps on all tables; soft-delete only where domain-appropriate
- Migrations are version-controlled SQL applied in order (README §40)

## Backups

- **Dev**: disposable; fake data only.
- **Staging**: provider snapshots as available.
- **Production**: point-in-time recovery + scheduled snapshots with a
  tested restore (configure at the managed-Postgres provider).
