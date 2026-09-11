# PROJECT RULES

```text
Mission: production-ready School Management System.
Frontend + Backend: Nuxt 4 + TypeScript (Vue 3 + Nitro server routes).
Database: PostgreSQL (source of truth).
Object storage: Cloudflare R2.
Compute: Cloudflare Workers (Nitro cloudflare-pages preset).
Background jobs: Cloudflare Queues.
Dev environment: GitHub Codespaces (.devcontainer/).

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
Run type-check, tests, lint and build before completing a phase.
Document architectural deviations.
```

## Cloud-first development — approved approach

Development happens in **GitHub Codespaces**, not on the local Mac.
The `.devcontainer/` folder defines a container with Node 24,
PostgreSQL 16 and wrangler. The Mac is a thin client: it only needs
TRAE CN, a browser, and a GitHub account.

No local PHP, Composer, Redis, Docker, Herd, Postgres.app, Valkey or
Homebrew is required.

Staging and production run on Cloudflare Workers with managed
PostgreSQL (Neon/Supabase), Cloudflare R2 buckets and Cloudflare
Queues. Never commit secrets — use Codespace Secrets or GitHub
repository secrets.

## Architecture migration note

The project migrated from the originally-approved Vue 3 + Laravel 12
stack to Nuxt 4 + Cloudflare Workers. The Laravel backend was never
scaffolded, so this was a greenfield build of the server layer. See
`ARCHITECTURE_DECISION_RECORD.md` and `MIGRATION_PLAN.md`.
