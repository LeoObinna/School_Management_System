# Architecture Decision Record (ADR)

**Project:** Victorious Children School / Victorious High School — School Management System (SMS)
**Date:** 2026-09-11
**Status:** PROPOSED — awaiting project owner approval
**Decision ID:** ADR-001

---

## Current Architecture

| Concern         | Current (Option A)                              |
|-----------------|-------------------------------------------------|
| Frontend        | Vue 3 + TypeScript + Vite + Pinia + Vue Router  |
| Backend         | Laravel 12 API + PHP 8.4 + Sanctum              |
| Database        | PostgreSQL 16                                   |
| Cache/queues    | Redis 7                                         |
| Object storage  | Cloudflare R2                                   |
| Edge/security   | Cloudflare DNS, TLS, WAF                        |
| Dev environment | GitHub Codespaces                               |

**Implementation state:** Frontend scaffold only. Laravel backend has
**not** been scaffolded (no `backend/` directory, no migrations, no
models).

---

## Evaluated Alternatives

### Option A — Keep current (Vue 3 + Laravel 12 + PostgreSQL + Redis)

Build the backend in Laravel 12 as originally planned.

### Option B — Migrate to Nuxt + Cloudflare Workers (PostgreSQL retained)

Replace Laravel with Nuxt 3 (Nitro server routes) deployed to
Cloudflare Workers. Keep PostgreSQL as the database (via Cloudflare
Hyperdrive or direct connection). Use Cloudflare R2 for storage and
Cloudflare Queues for background jobs.

### Option C — Migrate to Nuxt + Cloudflare D1 (NOT recommended)

Same as Option B but replace PostgreSQL with Cloudflare D1. Rejected
because D1 (SQLite) is unsuitable for the SMS's financial precision,
concurrent-write, and complex reporting requirements.

---

## Decision

**Migrate to Option B: Nuxt 3 + Cloudflare Workers + PostgreSQL.**

Do **not** use D1 as the primary database. PostgreSQL is retained.

---

## Reasons

1. **No backend exists yet.** The Laravel backend has not been
   scaffolded. Building the server layer in Nuxt now avoids a future
   costly rewrite. There is no production Laravel code to discard.

2. **Single TypeScript stack.** Nuxt unifies frontend and backend in
   TypeScript. This eliminates duplicated types, validation schemas,
   and context-switching between PHP and TS — a major maintainability
   win for a solo/beginner developer using TRAE.

3. **Native Cloudflare deployment.** Nuxt on Cloudflare Workers
   provides global edge compute, automatic scaling, integrated R2 and
   Queues, and a generous free tier. Option A only used Cloudflare as
   a passive edge proxy.

4. **Lower operational cost.** No PHP server or Redis to operate.
   Serverless Workers + managed PostgreSQL (Neon/Supabase free tiers)
   reduce cost and ops burden.

5. **Frontend is portable.** Nuxt is Vue. The existing Vue 3 scaffold
   (components, stores, router, types) adapts to Nuxt conventions with
   minimal rework.

6. **PostgreSQL preserved.** The database — the most critical
   architectural decision for this domain — remains PostgreSQL. Only
   the application runtime changes.

---

## Trade-offs

| Trade-off                            | Impact   | Mitigation                                                    |
|--------------------------------------|----------|---------------------------------------------------------------|
| Lose Laravel's batteries-included auth/RBAC | Medium | Build equivalent Nitro middleware; follow established patterns|
| Cloudflare vendor lock-in (Workers)  | Medium   | Abstract CF services; keep PG + R2(S3) portable; Nuxt can target Node |
| Workers CPU time limits              | Medium   | Offload report/PDF/image work to Cloudflare Queues            |
| No Eloquent ORM                      | Low      | Drizzle ORM provides type-safe PostgreSQL access              |
| No Laravel Form Requests             | Low      | zod schemas shared between client and server                  |
| Existing Codespace config needs update | Low    | Remove PHP feature, add wrangler; keep PostgreSQL             |

---

## What Changes

- Application runtime: Laravel (PHP) → Nuxt/Nitro (TypeScript on Workers)
- Dev server: dual (Vite + Artisan) → single (Nuxt)
- ORM: Eloquent → Drizzle
- Validation: Form Requests → zod
- Background jobs: Redis queues → Cloudflare Queues
- Auth: Laravel Sanctum → Nitro middleware + secure HTTP-only cookies
- Deployment: VPS/managed PHP → Cloudflare Workers
- CI: two jobs (frontend + backend) → one job (Nuxt)
- Test runners: Vitest + Pest → Vitest (unified)

## What Does NOT Change

- **PostgreSQL** remains the primary database and source of truth
- **Cloudflare R2** remains object storage
- **All business rules** (academic structure, lifecycle, attendance,
  timetable conflicts, result workflow, finance, admissions)
- **Permission model** (README §8)
- **Role definitions** (README §7)
- **Database model** (40+ tables, foreign keys, NUMERIC money)
- **API conventions** (`/api/v1`, JSON, pagination)
- **Security principles** (server-side authz, no secrets in code,
  audit logging, historical record preservation)
- **SMS-first priority** (public website deferred)

---

## Weighted Scores

| Criterion               | Option A | Option B |
|-------------------------|----------|----------|
| Database correctness    | 10       | 10       |
| Security                | 8        | 7        |
| Scalability             | 8        | 9        |
| Maintainability         | 6        | 9        |
| Development experience  | 6        | 9        |
| Cloudflare compatibility| 5        | 10       |
| Portability / lock-in   | 9        | 6        |
| Laptop / resources      | 7        | 8        |
| Testing                 | 7        | 9        |
| Cost / ops              | 6        | 9        |
| Codespaces              | 9        | 8        |
| **Weighted total**      | **7.60** | **8.75** |

---

## Migration Status

**Status:** PROPOSED — not yet started.

The migration will only begin after the project owner explicitly
approves with the following (or equivalent) statement:

> "I approve the recommended Nuxt + Cloudflare migration. Proceed
> incrementally and preserve the existing Laravel/Vue/PostgreSQL work."

No code has been migrated. No existing code has been deleted. The
existing `frontend/` directory and all documentation remain intact.

---

## Related Documents

- `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md` — full evidence-based comparison
- `MIGRATION_PLAN.md` — detailed phased migration plan
- `README.md` — master spec (to be updated after approval)
- `PROJECT_RULES.md` — project rules (to be updated after approval)

---

## Decision Review

This ADR will be reviewed:
- Before migration begins (owner approval)
- At the end of each migration phase
- If a critical issue with the Nuxt/Workers approach is discovered
