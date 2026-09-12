# Database Strategy

## PostgreSQL 16

PostgreSQL is the **source of truth** for all relational data. D1 is
not used. Evidence the current implementation requires real PostgreSQL:
52 Drizzle tables, 16 `pgEnum` types, 47 UUID primary keys, 20 `NUMERIC`
columns (money/scores), 80 index declarations, foreign keys and
service-layer transactions.

## Three separated environments

### 1. Development (local machine)

Any PostgreSQL 14+ reachable from the Mac — a local install or a remote
dev database (e.g. Neon free tier). No Docker is required. The
connection string is read by Nuxt/Drizzle from `app/.env`:

``` text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
```

For Workers-emulation (`npm run cf:dev`) the same URL is supplied to
Wrangler as
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (wired in the
`cf:dev` script). Only synthetic/fake demo data is allowed.

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
