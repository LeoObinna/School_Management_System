# PROJECT RULES

```text
Mission: production-ready School Management System.
Frontend + Backend: Nuxt 4 + TypeScript (Vue 3 + Nitro server routes).
Database: PostgreSQL (source of truth).
Object storage: Cloudflare R2 (R2_BUCKET binding; no S3 keys in the Worker).
Compute: Cloudflare Workers + Static Assets (Nitro cloudflare-module preset).
Background jobs: Cloudflare Queues (from Phase 10).
Dev environment: local machine (Node 24 + npm) with a reachable PostgreSQL.

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript across client and server.
Use reusable components.
Use zod for validation (shared schemas in shared/schemas/).
Use Nitro server middleware for authentication and RBAC.
Server-side authorization is authoritative — frontend guards are UX only.
Use Drizzle ORM for PostgreSQL (type-safe, NUMERIC for money).
Use database transactions for multi-write operations.
Use PostgreSQL as the source of truth — never D1 for primary data.
Use R2 for objects, PostgreSQL for file metadata.
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
npm run dev      # Nuxt dev server (Node); PostgreSQL via DATABASE_URL
npm run cf:dev   # build + wrangler dev (full Workers binding emulation)
npm run test / npm run type-check / npm run build
```

PostgreSQL is required for database work: a local instance or a remote
dev database (e.g. Neon free tier); no Docker, Kubernetes, Redis, PHP,
Composer or Laravel tooling is required. Migrations and seeds run
directly against PostgreSQL (`npm run db:migrate`, `npm run db:seed`),
never through Hyperdrive.

Staging and production run on Cloudflare Workers (`sms-staging` and
`sms-production` named environments in `app/wrangler.toml`) with
separate managed PostgreSQL databases reached through separate
Hyperdrive configs, and separate R2 buckets.

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
stack to Nuxt 4 + Cloudflare Workers. The Laravel backend was never
scaffolded, so this was a greenfield build of the server layer. See
`ARCHITECTURE_DECISION_RECORD.md` and `MIGRATION_PLAN.md`.
