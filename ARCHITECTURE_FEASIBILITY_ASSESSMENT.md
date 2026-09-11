# Architecture Feasibility Assessment

**Project:** Victorious Children School / Victorious High School — School Management System (SMS)
**Date:** 2026-09-11
**Status:** Phase 0 — infrastructure foundation (frontend scaffold only; backend not yet scaffolded)
**Assessor:** TRAE CN (automated feasibility assessment)

---

## 1. Executive Summary

This assessment evaluates whether the SMS should continue on its approved
**Vue 3 + Laravel 12 + PostgreSQL + Redis + Cloudflare** architecture
(Option A) or migrate to a **Nuxt + Cloudflare Workers + PostgreSQL**
architecture (Option B).

The decisive finding is that **the Laravel backend has not been
scaffolded yet.** Only a Vue 3 frontend scaffold exists (~10 source
files, 6 passing tests). There is no `backend/` directory, no Laravel
application, no migrations, no models, no controllers, and no database
schema. This means a migration to Nuxt is effectively a **greenfield
build of the backend** in the chosen architecture — not a risky rewrite
of existing production code.

**Recommendation: MIGRATE TO NUXT + CLOUDFLARE** while **retaining
PostgreSQL** as the primary database (accessed via Cloudflare
Hyperdrive or direct connection). **Do not use D1** as the primary
database — the SMS financial and relational requirements exceed D1's
capabilities.

The Nuxt architecture is recommended because it:

- Uses a single language (TypeScript) for frontend and server routes,
  reducing context-switching for a solo/beginner developer.
- Deploys natively to Cloudflare Workers, giving global edge compute,
  automatic scaling, and lower operational cost.
- Shares types between client and server, eliminating duplicated DTOs.
- Has a low migration cost now because there is no backend to migrate.
- Still preserves PostgreSQL (the correct database for this domain).

**Option A weighted score: 7.60 / 10**
**Option B weighted score: 8.75 / 10**

---

## 2. Current Architecture

Approved stack (from `README.md` §1 and `docs/ARCHITECTURE.md`):

```text
                    Cloudflare (DNS, TLS, WAF, CDN)
                           |
                           v
               Vue 3 + TypeScript + Vite (frontend)
                           | HTTPS / JSON
                           v
            Laravel 12 API + Sanctum + RBAC (backend)
                           |
           +---------------+---------------+---------------+
           |               |               |               |
           v               v               v               v
     PostgreSQL 16      Redis 7      Cloudflare R2    Audit Logs
     (source of truth)  (cache/queues) (object storage)
```

| Concern         | Technology                                     |
|-----------------|------------------------------------------------|
| Frontend        | Vue 3.5, TypeScript 6, Vite 8, Pinia 3, Tailwind 4 |
| Backend         | Laravel 12, PHP 8.4+, Sanctum, Eloquent        |
| Database        | PostgreSQL 16                                  |
| Cache/queues    | Redis 7                                        |
| Object storage  | Cloudflare R2 (S3-compatible)                  |
| Edge/security   | Cloudflare DNS, TLS, WAF                       |
| Source control  | Git + GitHub                                   |
| CI/CD           | GitHub Actions                                 |
| Dev environment | GitHub Codespaces (.devcontainer/)             |
| IDE             | TRAE CN                                        |

Development is cloud-first: the local 2017 MacBook (8 GB RAM) is a thin
client; all tooling runs in GitHub Codespaces.

---

## 3. Current Implementation State

### 3.1 What exists

| Component           | Status                        | Evidence                                                      |
|---------------------|-------------------------------|---------------------------------------------------------------|
| Frontend scaffold   | ✅ Built & passing            | `frontend/` — Vue 3 + TS + Vite + Pinia + Router + Tailwind   |
| Frontend tests      | ✅ 6 tests passing            | `BaseButton.test.ts`, `health.test.ts`                        |
| Frontend type-check | ✅ Passes                     | `vue-tsc --build`                                             |
| Frontend build      | ✅ Passes                     | `vue-tsc -b && vite build`                                    |
| Dev container       | ✅ Configured                 | `.devcontainer/Dockerfile`, `devcontainer.json`, features     |
| CI workflow         | ✅ Configured                 | `.github/workflows/ci.yml` (frontend job active)              |
| Documentation       | ✅ Comprehensive              | README + 8 docs in `docs/`                                    |
| **Laravel backend** | ❌ **NOT scaffolded**         | No `backend/` directory                                       |
| **Migrations**      | ❌ **None**                   | No database schema exists                                     |
| **Models**          | ❌ **None**                                                   |
| **Controllers/API** | ❌ **None**                                                   |
| **Authentication**  | ❌ **None**                                                   |
| **RBAC**            | ❌ **None**                                                   |
| **Database schema** | ❌ **None** (PG configured but empty)                          |

### 3.2 Frontend scaffold contents

- `src/main.ts` — app bootstrap (Pinia + Router)
- `src/App.vue` — root component
- `src/router/index.ts` — routes: `/` (dashboard), `/system-health`, 404
- `src/layouts/AppLayout.vue` — shell layout
- `src/components/ui/` — `BaseButton`, `BaseBadge`, `BaseCard`
- `src/services/api.ts` — centralized axios client (`/api/v1`, `withCredentials`)
- `src/services/health.ts` — health endpoint wrapper
- `src/stores/health.ts` — Pinia store demonstrating data/loading/error pattern
- `src/types/api.ts` — shared TypeScript types
- `src/views/` — `HomeView`, `HealthView`, `NotFoundView`

### 3.3 Git state

- Branch: `main` (only branch, up to date with `origin/main`)
- Commits: 8 (latest: `d5858dd fix: use devcontainer features for PHP/Node`)
- Working tree: clean
- No feature branches

### 3.4 Key conclusion

Because the backend does not exist, "migration" to Nuxt means building
the server layer in Nuxt/Nitro from the start. There is no Laravel code
to discard, no migrations to convert, no Eloquent models to port. The
only rework is adapting the small Vue 3 frontend scaffold to Nuxt's
conventions (file-based routing, `composables/`, `plugins/`,
auto-imports) — and Nuxt **is** Vue, so components and stores are
largely reusable as-is.

---

## 4. Proposed Nuxt Architecture

### Option B — Nuxt + Cloudflare

```text
                         Internet
                            |
                            v
                     Cloudflare Edge
                    (DNS, TLS, WAF, CDN)
                            |
                            v
                    Cloudflare Workers
                            |
                            v
                         Nuxt
                    Vue + TypeScript
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
         Nuxt Pages      Server/API     Background
         Components      Nitro Routes    Processing
             |              |              |
             +--------------+--------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
       PostgreSQL         R2           Queues
       (via Hyperdrive    Object Store  Background Jobs
        or direct)
```

**Database: PostgreSQL — NOT D1.** PostgreSQL is accessed from Workers
via Cloudflare Hyperdrive (connection pooling) or a direct TCP
connection to a managed PostgreSQL (Neon, Supabase, etc.).

**Nuxt application structure (target):**

```text
sms/
├── app/
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   ├── middleware/        # client-side route guards (UX only)
│   ├── pages/             # file-based routing
│   ├── plugins/
│   ├── stores/            # Pinia
│   ├── types/
│   └── utils/
├── server/
│   ├── api/               # Nitro server routes (/api/v1/...)
│   ├── middleware/        # server-side auth/RBAC enforcement
│   ├── plugins/
│   ├── services/          # domain logic
│   ├── repositories/      # data access (Drizzle ORM)
│   ├── utils/
│   └── jobs/              # Cloudflare Queues consumers
├── shared/
│   ├── types/             # shared client+server types
│   ├── schemas/           # zod validation schemas
│   └── constants/
├── database/
│   ├── migrations/        # Drizzle migrations
│   ├── seeds/
│   └── schema/            # Drizzle schema definitions
├── tests/
│   ├── unit/
│   ├── integration/       # server route tests
│   └── e2e/               # Playwright
└── ...
```

**Cloudflare services used (justified):**

| Service       | Purpose                                          | Justification                          |
|---------------|--------------------------------------------------|----------------------------------------|
| Workers       | Nuxt SSR + API runtime                           | Core compute                           |
| R2            | Object storage (files, photos, documents)        | Zero egress fees, S3-compatible        |
| Hyperdrive    | PostgreSQL connection pooling from Workers       | Required for PG access from Workers    |
| Queues        | Background jobs (reports, emails, notifications) | Async work beyond Worker CPU limits    |
| KV            | Optional: caching non-authoritative data         | Only if caching is demonstrably needed |
| Durable Objects | Optional: strong-consistency coordination       | Only if needed (e.g., timetable locks) |

**Cloudflare services NOT used (unnecessary):**

- **D1** — primary database (PostgreSQL is better for this domain)
- **KV as primary store** — source of truth must be PostgreSQL
- **Durable Objects for general state** — overkill for CRUD; use PG

---

## 5. Laptop / Resource Analysis

The developer machine is a **2017 Intel MacBook (i5 dual-core, 8 GB RAM,
macOS 13)**. The project has already pivoted to **GitHub Codespaces**,
so the Mac is a thin client running only TRAE CN + a browser.

| Criterion               | Option A (Laravel)                          | Option B (Nuxt)                            |
|-------------------------|---------------------------------------------|--------------------------------------------|
| Codespace runtime       | PHP 8.4 + Node 24 + PG 16 + Redis 7         | Node 24 + wrangler (+ optional PG service) |
| Local Mac requirements  | None (thin client)                          | None (thin client)                         |
| Codespace RAM footprint | Higher (PHP-FPM + PG + Redis + Node)        | Lower (Node + wrangler; PG can be remote)  |
| Dev servers             | 2 (Vite :5173 + Laravel :8000)              | 1 (Nuxt :3000, SSR + API unified)          |
| Hot reload              | Vite HMR + Laravel queue:listen             | Nuxt HMR (unified)                         |
| Build performance       | Separate frontend + backend builds          | Single build                              |

**Score: Option A 7/10, Option B 8/10**

Both architectures run in Codespaces, so the Mac itself is never the
bottleneck. Option B has a smaller Codespace footprint (no PHP runtime,
no Redis service if Queues replace it) and a single unified dev server.

---

## 6. TRAE Development Experience Analysis

| Criterion               | Option A                                      | Option B                                      |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Languages               | TypeScript (frontend) + PHP (backend)         | TypeScript (everywhere)                       |
| Dev servers             | 2 (Vite + Artisan)                            | 1 (Nuxt)                                      |
| Type sharing            | Duplicated (TS interfaces + PHP types/Resources) | Single source of truth (`shared/types/`)   |
| Test runners            | Vitest + Pest/PHPUnit                         | Vitest (unified)                              |
| Context switching       | High (PHP ↔ TS mental model)                  | Low (TS everywhere)                           |
| ORM                     | Eloquent (PHP)                                | Drizzle ORM (TS, type-safe)                   |
| Validation              | Laravel Form Requests                         | zod schemas (shared client+server)            |
| Auth                    | Laravel Sanctum (batteries-included)          | Custom Nitro middleware + secure cookies      |
| AI-assisted coding      | Good (Laravel + Vue are well-trained)         | Excellent (single TS codebase, fewer switches)|

**Score: Option A 6/10, Option B 9/10**

Option B's single-language, single-runtime model is a major DX win for
a solo/beginner/intermediate developer using TRAE. Shared zod schemas
and TypeScript types between client and server eliminate an entire
class of drift bugs.

---

## 7. GitHub / Codespaces Analysis

| Criterion               | Option A                                      | Option B                                      |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Codespace features      | PHP 8.4 + Node 24 + PG + Redis (configured)   | Node 24 + wrangler (+ PG, optional)           |
| Post-create script      | npm install + type-check + test; composer (if backend) | npm install + type-check + test         |
| CI pipeline             | 2 jobs (frontend + backend)                   | 1 job (Nuxt build + test)                     |
| Port forwarding         | 5173, 8000, 5432, 6379                        | 3000, 5432 (if local PG)                      |
| Existing config reuse   | ✅ Fully configured                           | ⚠️ Needs adaptation (remove PHP, add wrangler)|

**Score: Option A 9/10, Option B 8/10**

Option A's Codespace is already built and verified. Option B requires
updating `devcontainer.json` (remove PHP feature, add wrangler), but
this is a small, one-time change. The CI simplifies to a single job.

---

## 8. Cloudflare Analysis

| Criterion               | Option A                                      | Option B                                      |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Workers                 | Not used (Laravel on VPS)                     | ✅ Native runtime for Nuxt                    |
| R2                      | ✅ Used (S3-compatible)                        | ✅ Native binding                              |
| Hyperdrive              | Not needed (direct PG from VPS)               | ✅ For PG connection pooling from Workers      |
| Queues                  | Not used (Redis queues)                       | ✅ Native background jobs                      |
| KV                      | Not used                                      | Optional caching                              |
| Durable Objects         | Not used                                      | Optional (strong consistency)                 |
| WAF / Rate limiting     | ✅ Edge layer                                  | ✅ Edge layer + Worker-level                   |
| Cold starts             | N/A (always-on PHP-FPM)                       | Very low (Workers isolate, ~5ms)             |
| Global edge compute     | ❌ (origin VPS only)                           | ✅ (Workers run at 300+ edge locations)       |

**Score: Option A 5/10, Option B 10/10**

Option A treats Cloudflare as a passive edge proxy. Option B leverages
Cloudflare's compute platform natively, giving global distribution,
automatic scaling, and integrated storage/queuing.

---

## 9. Database Comparison

This is the most critical decision. The SMS requires:

- 40+ relational tables with foreign keys
- Exact decimal arithmetic for money (fees, invoices, payments)
- Historical academic records across sessions/terms
- Complex reporting queries (joins, aggregations, window functions)
- ACID transactions for financial and result workflows
- Concurrent writes (multiple teachers entering results, payments)

### PostgreSQL

| Aspect              | Rating | Notes                                                      |
|---------------------|--------|------------------------------------------------------------|
| Relational integrity| ✅ Excellent | Foreign keys, constraints, `CHECK`                       |
| Money precision     | ✅ Excellent | `NUMERIC`/`DECIMAL` exact arithmetic                       |
| Concurrency         | ✅ Excellent | MVCC, multiple writers, row-level locking                 |
| Reporting           | ✅ Excellent | Window functions, CTEs, `JSONB`, full-text search         |
| Transactions        | ✅ Excellent | Full ACID, savepoints                                      |
| Migrations          | ✅ Mature   | Drizzle/Prisma/Laravel migrations                          |
| Backups/restore     | ✅ Excellent | PITR, pg_dump, managed services                           |
| Portability         | ✅ High     | Runs anywhere; no vendor lock-in                           |
| Scaling             | ✅ Good     | Read replicas, partitioning, managed services             |

### Cloudflare D1 (SQLite)

| Aspect              | Rating | Notes                                                      |
|---------------------|--------|------------------------------------------------------------|
| Relational integrity| ⚠️ Moderate | FK support, but weaker constraint enforcement             |
| Money precision     | ❌ Poor   | SQLite stores NUMERIC as REAL (float) unless stored as TEXT — dangerous for money |
| Concurrency         | ❌ Poor   | Single-writer model; serialized writes                     |
| Reporting           | ⚠️ Moderate | No window functions (until recent versions), limited CTEs  |
| Transactions        | ⚠️ Good   | ACID within single DB, but no cross-row concurrency        |
| Migrations          | ✅ Good   | wrangler d1 migrations                                     |
| Backups/restore     | ⚠️ Moderate | Export/import, less mature PITR                           |
| Portability         | ✅ High   | SQLite file, but Cloudflare API lock-in for access        |
| Scaling             | ❌ Poor   | Single writer limits write throughput; max 100k rows/dataset guidance |

### PostgreSQL via Cloudflare Hyperdrive

| Aspect              | Rating | Notes                                                      |
|---------------------|--------|------------------------------------------------------------|
| Relational integrity| ✅ Excellent | Same as PostgreSQL                                          |
| Money precision     | ✅ Excellent | Same as PostgreSQL                                          |
| Concurrency         | ✅ Excellent | Same as PostgreSQL + connection pooling via Hyperdrive      |
| Reporting           | ✅ Excellent | Same as PostgreSQL                                          |
| Transactions        | ✅ Excellent | Same as PostgreSQL                                          |
| Migrations          | ✅ Mature   | Same as PostgreSQL                                          |
| Backups/restore     | ✅ Excellent | Managed PostgreSQL (Neon/Supabase) + Hyperdrive            |
| Portability         | ✅ High     | PostgreSQL is portable; Hyperdrive is a Cloudflare-only pooler but replaceable |
| Scaling             | ✅ Excellent | Managed PG auto-scaling + Hyperdrive pooling               |

### Database recommendation

**Keep PostgreSQL.** Do not migrate to D1.

Rationale:
1. The SMS financial module requires exact decimal arithmetic. SQLite
   (D1) stores `NUMERIC` as floating-point `REAL`, risking money
   precision errors. Storing money as TEXT is a workaround that
   complicates every query.
2. The SMS has high concurrent write needs (multiple teachers entering
   scores simultaneously, multiple payments). D1's single-writer model
   is a poor fit.
3. The SMS requires complex reporting (class averages, term summaries,
   financial reports) that benefit from PostgreSQL's window functions,
   CTEs, and `JSONB`.
4. PostgreSQL is portable and has mature tooling for backups, restore,
   and migrations.

Access PostgreSQL from Cloudflare Workers via **Hyperdrive**
(connection pooling that makes Workers↔PG efficient) or a direct
connection to a managed PostgreSQL provider (Neon, Supabase, etc.).

**Score: Option A (PostgreSQL) 10/10, Option B with D1 4/10, Option B with PostgreSQL 10/10**

---

## 10. Security Comparison

| Aspect                  | Option A (Laravel)                         | Option B (Nuxt/Nitro)                      |
|-------------------------|--------------------------------------------|--------------------------------------------|
| Authentication          | Laravel Sanctum (batteries-included)       | Custom: secure HTTP-only cookies + session store |
| Session management      | Laravel session (Redis/file)               | Custom: signed cookies + server-side session |
| CSRF                    | Laravel CSRF middleware (built-in)         | Custom: CSRF token validation in middleware|
| Authorization           | Policies/Gates (built-in, mature)          | Custom: Nitro middleware + permission checks|
| RBAC                    | spatie/laravel-permission or custom        | Custom: role/permission tables + guards    |
| Password hashing        | bcrypt/argon2 (built-in)                   | node:bcrypt or argon2 (via library)        |
| Input validation        | Form Requests (built-in)                   | zod schemas (shared)                       |
| SQL injection           | Eloquent parameterized queries             | Drizzle parameterized queries              |
| XSS                     | Blade auto-escaping + Vue                  | Vue auto-escaping                           |
| Rate limiting           | Laravel throttle + Cloudflare              | Cloudflare WAF + custom Worker rate limit  |
| Secure cookies          | Laravel session config                     | Custom cookie flags (HttpOnly, Secure, SameSite) |
| File security           | R2 presigned URLs via Laravel              | R2 presigned URLs via Worker binding       |
| Audit logging           | Custom (Laravel events/listeners)          | Custom (Nitro hooks)                        |
| Payment webhook verify  | Laravel (custom, mature patterns)          | Nitro (custom, same patterns)              |

**Score: Option A 8/10, Option B 7/10**

Laravel provides more security infrastructure out of the box
(Sanctum, policies, gates, CSRF). Option B requires building auth,
session, and RBAC in Nitro middleware. However, these are well-understood
patterns and Cloudflare's WAF + secure-by-default Workers help. The
server remains authoritative in both cases.

**Mitigation for Option B:** Implement a `server/middleware/auth.ts`
that validates sessions on every request, a `server/middleware/rbac.ts`
for permission checks, use `h3` event handlers with zod validation,
and store sessions in a signed HTTP-only cookie (or KV for server-side
session state). Use Cloudflare Turnstile for bot protection on login.

---

## 11. Scalability Comparison

| Scale                     | Option A (Laravel)                         | Option B (Nuxt + Workers)                  |
|---------------------------|--------------------------------------------|--------------------------------------------|
| 100 students              | ✅ Trivial                                 | ✅ Trivial                                 |
| 500 students              | ✅ Trivial                                 | ✅ Trivial                                 |
| 1,000 students            | ✅ Easy                                    | ✅ Easy                                    |
| 5,000 students            | ✅ Manageable (load balance PHP-FPM, read replicas) | ✅ Easy (Workers auto-scale, Hyperdrive pools) |
| Multiple campuses         | ✅ Add tenant_id column                     | ✅ Same                                    |
| Multiple schools          | ✅ Schema or DB per tenant                  | ✅ Same                                    |
| Parent traffic spikes     | ✅ Cache + load balance                    | ✅ Edge cache + Workers scale             |
| Simultaneous result entry | ✅ PG row-level locks                      | ✅ Same (PG)                               |
| Reporting                 | ✅ PG queries, queue-heavy reports         | ✅ Same (PG) + Workers for aggregation    |
| Financial transactions    | ✅ PG transactions                         | ✅ PG transactions                         |
| File uploads              | ✅ R2 direct upload                         | ✅ R2 direct upload                         |
| Background jobs           | Redis queues (Laravel Horizon)             | Cloudflare Queues                         |
| Scheduled tasks           | Laravel scheduler (cron)                   | Cron Triggers (Workers)                    |
| Future mobile app         | ✅ REST API                                | ✅ REST API (Nitro routes)                 |
| External API integrations | ✅ Laravel HTTP client                      | ✅ $fetch / ofetch                          |

**Score: Option A 8/10, Option B 9/10**

Both architectures scale adequately for the SMS. Option B has an edge
in automatic global scaling (Workers) and lower ops overhead. Workers
have CPU time limits (30s paid, 50ms free), so CPU-bound work (report
generation, PDF rendering, image processing) must be offloaded to
**Cloudflare Queues** — which is the correct pattern anyway.

---

## 12. Testing Comparison

| Layer      | Option A                                      | Option B                                      |
|------------|-----------------------------------------------|-----------------------------------------------|
| Unit       | Vitest (frontend) + Pest/PHPUnit (backend)    | Vitest (unified)                              |
| Integration| Pest feature tests                            | Vitest + h3 testing utilities                 |
| API        | Pest                                          | Vitest (server route tests)                   |
| Auth tests | Pest                                          | Vitest                                        |
| DB tests   | Pest + DB transactions                        | Vitest + Drizzle + test database              |
| E2E        | Playwright                                    | Playwright                                    |
| Type-check | vue-tsc (frontend only)                       | vue-tsc / nuxt typecheck (full stack)         |

**Score: Option A 7/10, Option B 9/10**

Option B unifies testing under a single runner (Vitest) for both
client and server code. Server routes can be tested with h3's
`createEvent`/`callEventHandler` utilities. Type checking covers the
entire stack.

---

## 13. Maintainability Comparison

| Aspect                  | Option A                                      | Option B                                      |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Codebases               | 2 (frontend + backend)                        | 1 (Nuxt monorepo)                             |
| Languages               | 2 (TS + PHP)                                  | 1 (TS)                                        |
| Type duplication        | High (TS interfaces ↔ PHP Resources/DTOs)     | None (shared types)                           |
| Business logic location | Laravel Services/Actions (PHP)                | server/services (TS)                          |
| Validation              | Form Requests (PHP) + client validation (TS)  | zod schemas (shared)                          |
| Auth/RBAC               | Sanctum + Policies (PHP)                      | Nitro middleware (TS)                         |
| Developer onboarding    | Must learn Vue + Laravel + PHP + Eloquent     | Learn Vue + Nuxt + TS (single stack)          |
| AI-assisted dev         | Good but split context                        | Excellent (single TS codebase)                |
| Separation of concerns  | Strong (frontend/backend split)              | Strong (client/server via Nuxt conventions)   |

**Score: Option A 6/10, Option B 9/10**

For a solo or small team using TRAE, the single-stack Nuxt model is
significantly more maintainable. No need to duplicate types,
validation, or switch between PHP and TS mental models.

---

## 14. Vendor Lock-in Analysis

| Component               | Option A lock-in                              | Option B lock-in                              |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Compute runtime         | Low (Laravel runs anywhere PHP runs)          | Medium (Cloudflare Workers runtime)           |
| Database                | None (PostgreSQL portable)                    | None (PostgreSQL portable; Hyperdrive replaceable) |
| Object storage          | Low (R2 is S3-compatible, swappable)          | Low (R2 is S3-compatible, swappable)          |
| Background jobs         | Low (Redis queues, swappable)                 | Medium (Cloudflare Queues API)                |
| Caching                 | Low (Redis, swappable)                        | Low-Medium (KV, but can abstract)             |
| Edge/security           | Low (Cloudflare is swappable for DNS/WAF)     | Medium (Workers + edge = core platform)       |

**Score: Option A 9/10, Option B 6/10**

Option B has more Cloudflare lock-in (Workers, Queues, optionally KV).
This is the primary trade-off. **Mitigation:**

1. Keep business logic in framework-agnostic `server/services/` and
   `server/repositories/` so it can be ported to another TS runtime.
2. Use R2 via the S3-compatible SDK (portable to any S3 storage).
3. Abstract Cloudflare Queues behind a job-dispatch interface.
4. Use PostgreSQL (not D1) so the data layer is fully portable.
5. Nuxt can also be deployed to a Node server (`node-server` preset)
   as a fallback if leaving Cloudflare.

The lock-in is acceptable because Cloudflare provides meaningful
operational benefits (global edge, auto-scaling, no servers to manage,
generous free tier) and the most critical assets (data in PostgreSQL,
files in S3-compatible R2) remain portable.

---

## 15. Migration Complexity

Because the Laravel backend does **not exist**, migration complexity is
dramatically lower than a typical framework migration.

| Area                    | Complexity | Notes                                                        |
|-------------------------|------------|--------------------------------------------------------------|
| Frontend migration      | MEDIUM     | Vue components reusable; adapt to Nuxt file routing, composables, auto-imports |
| Backend migration       | LOW        | No backend exists — build fresh in Nitro server routes       |
| Database migration      | N/A        | No schema exists — design fresh with Drizzle                 |
| Authentication          | LOW        | Build fresh (Nitro middleware + secure cookies)              |
| RBAC                    | LOW        | Build fresh (permission tables + guards)                     |
| API migration           | LOW        | Build fresh (Nitro `/api/v1` routes matching README §24)     |
| File storage migration  | LOW        | R2 already planned; Worker bindings replace Laravel storage  |
| Testing migration       | LOW        | Build fresh (Vitest for all layers)                          |
| Deployment migration    | MEDIUM     | Set up Workers + R2 + Hyperdrive + Queues                    |
| Documentation migration | MEDIUM     | Update README, PROJECT_RULES, docs                           |

**Reusable existing components:**
- Vue 3 UI components (`BaseButton`, `BaseBadge`, `BaseCard`) — move to `app/components/`
- Pinia store pattern (`health.ts`) — move to `app/stores/`
- Router structure — convert to Nuxt file-based pages
- API client (`api.ts`) — reuse as `app/services/api.ts` or Nuxt `$fetch`
- TypeScript types (`types/api.ts`) — move to `shared/types/`
- All documentation (database model, business rules, API spec) — preserve as-is

**Overall migration risk: LOW-MEDIUM.** The backend is greenfield;
the frontend is small and Vue-compatible.

---

## 16. Risk Analysis

| Risk                                    | Likelihood | Impact | Mitigation                                                     |
|-----------------------------------------|------------|--------|----------------------------------------------------------------|
| Workers CPU limits block report/PDF gen | Medium     | High   | Offload to Cloudflare Queues; use Durable Objects for long work|
| Auth/RBAC reinvented insecurely         | Medium     | High   | Follow established patterns; server-side enforcement; audit    |
| Cloudflare lock-in reduces portability  | Medium     | Medium | Abstract CF services; keep PG + R2(S3) portable                |
| Hyperdrive latency for PG queries       | Low        | Medium | Benchmark; use direct connection if needed; cache read-heavy data |
| D1 incorrectly chosen for financial data| Low        | Critical | Explicitly rejected; PostgreSQL retained                       |
| Existing frontend lost in migration     | Low        | Medium | Nuxt is Vue; components portable; incremental migration        |
| Documentation drift                     | Medium     | Low    | Update docs alongside implementation                           |
| No Laravel ecosystem (Eloquent, etc.)   | Medium     | Medium | Drizzle + zod + custom middleware cover equivalents            |

---

## 17. Cost / Operational Complexity Analysis

| Aspect                  | Option A                                      | Option B                                      |
|-------------------------|-----------------------------------------------|-----------------------------------------------|
| Compute                 | VPS or managed PHP (≈$5–20/mo)               | Cloudflare Workers (free tier → pay-per-request) |
| Database                | Managed PostgreSQL (≈$15–50/mo)              | Managed PostgreSQL (Neon/Supabase free tier available) |
| Cache/queues            | Managed Redis (≈$5–15/mo)                     | Cloudflare Queues (free tier available)       |
| Object storage          | R2 (no egress fees)                           | R2 (no egress fees)                           |
| Bandwidth/egress        | VPS bandwidth + Cloudflare                    | Cloudflare (no egress on R2; Workers generous)|
| Servers to manage       | PHP server + PG + Redis                       | None (serverless Workers; managed PG)         |
| Monitoring              | Server + app + DB                             | Cloudflare dashboard + app                    |
| Free tier availability  | Limited (cheap VPS needed)                    | Generous (Workers, R2, Queues, Neon PG)       |

**Score: Option A 6/10, Option B 9/10**

Option B likely costs less to operate (serverless compute, generous
Cloudflare free tiers, no Redis to manage) and requires less
operational overhead.

---

## 18. Weighted Scorecard

| Criterion               | Weight | Option A | Option B | A×W    | B×W    |
|-------------------------|--------|----------|----------|--------|--------|
| Database correctness    | 20%    | 10       | 10       | 2.00   | 2.00   |
| Security                | 15%    | 8        | 7        | 1.20   | 1.05   |
| Scalability             | 10%    | 8        | 9        | 0.80   | 0.90   |
| Maintainability         | 10%    | 6        | 9        | 0.60   | 0.90   |
| Development experience  | 10%    | 6        | 9        | 0.60   | 0.90   |
| Cloudflare compatibility| 10%    | 5        | 10       | 0.50   | 1.00   |
| Portability / lock-in   | 5%     | 9        | 6        | 0.45   | 0.30   |
| Laptop / resources      | 5%     | 7        | 8        | 0.35   | 0.40   |
| Testing                 | 5%     | 7        | 9        | 0.35   | 0.45   |
| Cost / ops              | 5%     | 6        | 9        | 0.30   | 0.45   |
| Codespaces              | 5%     | 9        | 8        | 0.45   | 0.40   |
|-------------------------|--------|----------|----------|--------|--------|
| **Total**               | 100%   |          |          | **7.60** | **8.75** |

**Option B (Nuxt + Cloudflare Workers + PostgreSQL) wins by 1.15 points.**

The largest gaps favoring Option B:
- Cloudflare compatibility (+5)
- Development experience (+3)
- Maintainability (+3)
- Testing (+2)
- Cost/ops (+3)

Option A's advantages:
- Security (+1) — Laravel's batteries-included auth/RBAC
- Portability (+3) — less Cloudflare lock-in
- Codespaces (+1) — already configured

---

## 19. Final Recommendation

### MIGRATE TO NUXT + CLOUDFLARE

**with PostgreSQL retained as the primary database (via Hyperdrive or direct).**

This recommendation is evidence-based:

1. **No backend exists.** The Laravel backend has not been scaffolded.
   Building it now in Nuxt avoids a future costly rewrite.
2. **Single TypeScript stack** reduces complexity for a solo developer
   using TRAE and eliminates type/validation duplication.
3. **Native Cloudflare deployment** gives global edge compute,
   auto-scaling, and lower operational cost.
4. **PostgreSQL is preserved**, so the database remains the correct,
   relational, ACID-compliant store for financial and historical data.
5. **Frontend is portable** — Nuxt is Vue, so the existing scaffold
   adapts with minimal rework.
6. **Cloudflare free tier** reduces cost during early development.

**Do not use D1** as the primary database. PostgreSQL is non-negotiable
for this domain's financial, relational, and reporting requirements.

---

## 20. Recommended Target Architecture

```text
                         Internet
                            |
                            v
                  Cloudflare Edge (DNS, TLS, WAF)
                            |
                            v
                  Cloudflare Workers
                            |
                            v
              Nuxt 3 (Vue 3 + TypeScript)
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
   Nuxt Pages         Nitro Server Routes   Background
   (SSR/CSR)          (/api/v1/*)           Processing
        |                   |                   |
        +-------------------+-------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
  PostgreSQL (via      Cloudflare R2      Cloudflare Queues
   Hyperdrive or       (object storage)   (report gen,
   direct connection)                     emails, exports)

  Auth/RBAC: Nitro server middleware (authoritative)
  Validation: zod schemas (shared client+server)
  ORM: Drizzle (type-safe PostgreSQL)
  Sessions: signed HTTP-only cookies + optional KV
```

---

## 21. Migration Phases (if migration is approved)

See `MIGRATION_PLAN.md` for the detailed phase plan. Summary:

- **Phase 0**: Git checkpoint + Nuxt scaffold alongside existing frontend
- **Phase 1**: Database connectivity (Drizzle + PostgreSQL) + shared types
- **Phase 2**: Authentication & RBAC (Nitro middleware, secure cookies, permissions)
- **Phase 3**: Migrate frontend scaffold to Nuxt conventions
- **Phase 4–13**: Build business modules (academic core, people, attendance, results, finance, admissions, communication, reports)
- **Phase 14**: Testing & security hardening
- **Phase 15**: Staging deployment (Workers + R2 + Hyperdrive)
- **Phase 16**: Data verification
- **Phase 17**: Production cutover

The existing Vue frontend remains in the repo until the Nuxt app reaches
feature parity. No deletion until quality gates pass.

---

## 22. Rollback Strategy

1. **Git checkpoint**: Tag the current `main` before migration
   (`pre-nuxt-migration`). The existing frontend + docs are preserved.
2. **Parallel existence**: The Nuxt app lives in a new top-level
   directory (e.g., `app/` or `nuxt/`) while `frontend/` remains.
3. **Reversible commits**: Each phase is a separate, reviewable PR.
4. **No destructive changes**: No existing code is deleted until the
   Nuxt app passes all quality gates.
5. **Rollback trigger**: If Nuxt migration is abandoned, delete the
   Nuxt directory and revert to the Laravel plan. PostgreSQL and R2
   decisions remain valid regardless.

---

## 23. Items That Must Remain Unchanged

- **PostgreSQL** as the primary database (no D1 for primary data)
- **Cloudflare R2** for object storage
- **All business rules** in README §13–§22 (academic structure, student
  lifecycle, attendance, timetable conflicts, result workflow, finance,
  admissions, file security)
- **Permission model** in README §8
- **Role definitions** in README §7
- **Database model** in README §12 (40+ tables, foreign keys, NUMERIC money)
- **API conventions** in README §24 (`/api/v1`, JSON, pagination)
- **Security principles** in README §25 and `docs/SECURITY.md`
- **Audit logging** requirements
- **Historical record preservation**
- **No real student data** in dev/staging
- **No secrets in code**
- **SMS first; public website later**

---

## 24. Open Questions

1. **Managed PostgreSQL provider**: Neon, Supabase, or another?
   (Recommendation: Neon for serverless PG + Hyperdrive compatibility.)
2. **KV for sessions**: Use signed cookies only, or KV-backed server
   sessions? (Recommendation: signed HTTP-only cookies for simplicity;
   KV only if session revocation needs server-side state.)
3. **Durable Objects**: Needed for any strong-consistency use case
   (e.g., timetable booking)? (Recommendation: evaluate per-module;
   default to PG.)
4. **Email delivery**: Cloudflare Email Routing or third-party
   (Resend, SendGrid)?
5. **PDF report cards**: Generate in Worker (within CPU limit) or via
   Queue + headless browser?
6. **CI deployment**: GitHub Actions → `wrangler deploy`, or Cloudflare
   Pages build?

---

## 25. Exact Next Steps

1. **Project owner approves** the migration (see approval phrase in
   `ARCHITECTURE_DECISION_RECORD.md`).
2. **Git checkpoint**: Tag `pre-nuxt-migration` on `main`.
3. **Create `MIGRATION_PLAN.md`** with detailed phases (done in this
   assessment).
4. **Phase 0**: Scaffold Nuxt 3 app in a new directory, configure
   Cloudflare Workers preset, Drizzle ORM, and PostgreSQL connection.
5. **Update `devcontainer.json`**: Remove PHP feature, add wrangler;
   keep PostgreSQL for dev.
6. **Update `PROJECT_RULES.md`** and `README.md` to reflect the Nuxt
   architecture (after approval).
7. **Proceed phase-by-phase** per `MIGRATION_PLAN.md`.

---

*End of feasibility assessment. No code was migrated during this
assessment. Awaiting project owner approval before any migration work
begins.*
