# PROJECT RULES

```text
Mission: production-ready School Management System.
Frontend + Backend: Nuxt 4 + TypeScript (Vue 3 + Nitro server routes).
Database: Cloudflare D1 (SQLite) — the only database in every
            environment (local, production), authoritative per
            v2.0 spec, 2026-09-21.
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
Use Drizzle ORM (SQLite dialect; D1 in every environment).
Use INTEGER kobo for money (₦150,000 = 15,000,000); INTEGER fixed-point
×100 for scores/weights/grade boundaries; TEXT ISO-8601 UTC for
timestamps; YYYY-MM-DD for dates; HH:MM:SS for times; TEXT app-generated
UUIDs for IDs; TEXT + CHECK for enums.
Use D1 batch (single transaction) for multi-write operations; interactive
transactions are NOT available on D1/SQLite.
D1 is the authoritative source of truth — no fallback database remains
(policy reversed 2026-09-21; see README §52).
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
npm run dev      # Nuxt dev server (Node); D1 via wrangler getPlatformProxy
npm run cf:dev   # build + wrangler dev (D1 + R2 + KV + Queues)
npm run test / npm run type-check / npm run build
```

The `DB` D1 binding is declared in `app/wrangler.toml` under
`[[d1_databases]]`. Local dev reaches it through
`wrangler getPlatformProxy({ persist: true })` during `nuxt dev`; state
persists under `.wrangler/state/v3/d1/`. No connection string is
required. Apply D1 migrations locally with
`npx wrangler d1 migrations apply DB --local`.

No Docker, Kubernetes, Redis, PHP, Composer or Laravel tooling is
required. Migrations and seeds run via wrangler against the local
D1 binding (`npm run db:migrate`, `npm run db:seed`). Never run
database migrations through Hyperdrive or any direct DB connection
string — use `npm run db:migrate` (wrangler d1 migrations apply DB
--local).

Production runs on Cloudflare Workers (`sms-production` named
environment in `app/wrangler.toml`) with its own D1 database
(binding `DB`) and R2 bucket.

**Deployment is manual only**, initiated from the local terminal:

```text
npm run deploy:production   # npm run build + wrangler deploy -e production
```

There is no GitHub Actions deployment, no Cloudflare Pages Git
integration, no Workers Builds, and no automatic deployment on push or
pull request. GitHub is used strictly for source control and version
history.

Never commit secrets. Local secrets live only in the gitignored
`app/.env`; production secrets are stored with
`wrangler secret put -e production` (or the Cloudflare dashboard).

## Architecture migration note

The project migrated from the originally-approved Vue 3 + Laravel 12
stack to Nuxt 4 + Cloudflare Workers (see
`ARCHITECTURE_DECISION_RECORD.md` and `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`
for the historical decision). The Laravel backend was never scaffolded,
so this was a greenfield build of the server layer.

**v2.0 D1 migration (2026-09-21+, owner-approved):** D1 is now the
authoritative database per `docs/spec/v2/` and the only database in
every environment (local, production). Migration phases live
in `MIGRATION_GAP_REPORT.md` at repo root and README §52; the canonical
spec package lives under `docs/spec/v2/`.
