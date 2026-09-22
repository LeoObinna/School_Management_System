# PROJECT RULES

```text
Mission: production-ready School Management System.
Frontend + Backend: Nuxt 4 + TypeScript (Vue 3 + Nitro server routes).
Database: Cloudflare D1 (authoritative per v2.0 spec, 2026-09-21).
            PostgreSQL/Neon/Hyperdrive retained as live staging
            fallback ONLY until D1 staging passes acceptance (Phase 6).
Object storage: Cloudflare R2 (R2_BUCKET binding; no S3 keys in the Worker).
Compute: Cloudflare Workers + Static Assets (Nitro cloudflare-module preset).
Background jobs: Cloudflare Queues + Cron Triggers.
Edge state: Cloudflare KV (rate limiter + session revocation; non-authoritative).
Dev environment: local machine (Node 24 + npm); wrangler dev for D1/R2/KV/Queues.

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript across client and server.
Use reusable components.
Use zod for validation (shared schemas in shared/schemas/).
Use Nitro server middleware for authentication and RBAC.
Server-side authorization is authoritative — frontend guards are UX only.
Use Drizzle ORM (PostgreSQL temporarily; D1 from Phase 2).
Use INTEGER kobo for money (₦150,000 = 15,000,000); INTEGER fixed-point
×100 for scores/weights/grade boundaries; TEXT ISO-8601 UTC for
timestamps; YYYY-MM-DD for dates; HH:MM:SS for times; TEXT app-generated
UUIDs for IDs; TEXT + CHECK for enums.
Use D1 batch (single transaction) for multi-write operations; interactive
transactions are NOT available on D1/SQLite (Phase 3 adapts the 17 PG
interactive transactions to D1 batch).
D1 is the authoritative source of truth — never PostgreSQL for primary
data (policy reversed 2026-09-21; see README §52).
Use R2 for objects, D1 for file metadata.
Keep server routes thin; put domain logic in server/services/.
Never hard-code secrets or school policy.
Never trust client authorization claims.
Preserve historical records.
Add tests for critical behavior and authorization boundaries.
Run type-check, tests and build before completing a phase.
Document architectural deviations.
```

## Local development + Cloudflare-only deployment — approved approach

Development happens on the local machine with Node 24 and npm. The app
runs three ways, all from `app/`:

```text
npm run dev      # Nuxt dev server (Node); PG via DATABASE_URL (legacy)
npm run cf:dev   # build + wrangler dev (D1 + Hyperdrive + R2 + KV + Queues)
npm run test / npm run type-check / npm run build
```

Phase 1 (D1 migration, 2026-09-22) declares the D1 binding `DB`
alongside the legacy HYPERDRIVE binding in `app/wrangler.toml`. db.ts
dispatches on Hyperdrive by default; the D1 path is wired and inert
until Phase 2 flips `SMS_USE_D1=true`. Local dev still uses PostgreSQL
via DATABASE_URL until Phase 2 rewrites the schema to SQLite/D1, after
which `wrangler dev` + the local D1 binding replaces `nuxt dev` for
database work. Apply D1 migrations locally with
`npx wrangler d1 migrations apply DB --local`.

PostgreSQL is required only as the legacy fallback: a local instance
(Postgres.app, database `sms_dev`) or the Neon staging instance
(`STAGING_DATABASE_URL`). No Docker, Kubernetes, Redis, PHP, Composer
or Laravel tooling is required. PG migrations and seeds run directly
against PostgreSQL (`npm run db:migrate`, `npm run db:seed`), never
through Hyperdrive. These scripts are removed in Phase 6 once D1
staging passes acceptance.

Staging and production run on Cloudflare Workers (`sms-staging` and
`sms-production` named environments in `app/wrangler.toml`) with
separate D1 databases (binding `DB`) AND separate Hyperdrive configs
(binding `HYPERDRIVE`, fallback only) and separate R2 buckets.

**Deployment is manual only**, initiated from the local terminal:

```text
npm run deploy:staging      # npm run build + wrangler deploy -e staging
npm run deploy:production   # npm run build + wrangler deploy -e production
```

There is no GitHub Actions deployment, no Cloudflare Pages Git
integration, no Workers Builds, and no automatic deployment on push or
pull request. GitHub is used strictly for source control and version
history.

Never commit secrets. Local secrets live only in the gitignored
`app/.env`; staging/production secrets are stored with
`wrangler secret put -e <env>` (or the Cloudflare dashboard).

## Architecture migration note

The project migrated from the originally-approved Vue 3 + Laravel 12
stack to Nuxt 4 + Cloudflare Workers (see
`ARCHITECTURE_DECISION_RECORD.md` and `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`
for the historical decision). The Laravel backend was never scaffolded,
so this was a greenfield build of the server layer.

**v2.0 D1 migration (2026-09-21+, owner-approved):** D1 is now the
authoritative database per `docs/spec/v2/`. PostgreSQL/Neon/Hyperdrive
are decommissioned ONLY after a D1 staging deployment passes acceptance
(Phase 6). The live PG-backed staging Worker stays as fallback until
then. Migration phases live in `MIGRATION_GAP_REPORT.md` at repo root
and README §52; the canonical spec package lives under `docs/spec/v2/`.
