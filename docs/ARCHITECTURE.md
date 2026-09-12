# Architecture

Status: **Phases 0–6 complete** on Nuxt 4 + Cloudflare Workers. Phase 7
(exams/results) not started.

## Overview

``` text
                    Cloudflare (DNS, TLS, WAF, CDN)
                           |
                           v
        Cloudflare Worker (sms-staging / sms-production)
        Nuxt 4 SSR + Nitro /api/v1 routes (+ Static Assets)
                           |
           +---------------+---------------+
           |                               |
           v                               v
     Hyperdrive -> PostgreSQL 16     R2_BUCKET (objects)
     (source of truth, Drizzle)      metadata keys in PostgreSQL

     (Queues + Cron Triggers join from Phase 10; audit logs live in PG)
```

## Stack

| Concern         | Technology                                     |
|-----------------|------------------------------------------------|
| Application     | Nuxt 4 (Vue 3, TypeScript) + Nitro server routes |
| Runtime         | Cloudflare Workers + Static Assets (cloudflare-module) |
| Database        | PostgreSQL 16 (Drizzle ORM; Hyperdrive binding in Workers) |
| Background jobs | Cloudflare Queues + Cron Triggers (from Phase 10) |
| Object storage  | Cloudflare R2 via R2_BUCKET binding            |
| Edge/security   | Cloudflare DNS, TLS, WAF                        |
| Source control  | Git + GitHub (version history only)             |
| Deployment      | Manual `wrangler deploy` from the local Mac     |
| Dev environment | Local Node 24 + npm + reachable PostgreSQL      |
| IDE             | TRAE CN                                         |

## Development environment

Development runs locally with Node 24 and npm. There is no devcontainer,
Docker, Redis, PHP or Composer. PostgreSQL for development is a local
instance or a remote dev database reached via `DATABASE_URL` in the
gitignored `app/.env`.

``` text
npm run dev       # Nuxt dev server (Node runtime, DATABASE_URL)
npm run cf:dev    # build + wrangler dev (full Workers binding emulation)
npm run test      # Vitest
npm run type-check
npm run build
```

## Repository structure

``` text
School_Management_System/
├── README.md                    # Master spec (single source of truth)
├── PROJECT_RULES.md             # Hard rules for TRAE
├── .gitignore
├── .trae/rules/
│   └── project_rules.md         # TRAE operating rules
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   ├── CLOUDFLARE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── TESTING.md
│   ├── SECURITY.md
│   └── FRONTEND.md
├── app/                         # Nuxt 4 application (all active code)
│   ├── wrangler.toml            # Workers config (staging/production envs)
│   ├── wrangler.pages.toml      # retired Pages config, kept for rollback
│   ├── server/                  # Nitro API routes, services, utils
│   ├── database/                # Drizzle schema, migrations, seeds
│   ├── shared/                  # zod schemas + TS types (client/server)
│   └── pages/, components/, stores/
└── frontend/                    # legacy pre-migration scaffold (unused)
```

## Principles

1. **PostgreSQL is the source of truth** (never D1 for primary data).
2. **R2 for objects, PostgreSQL for metadata.** Never store files in the DB.
3. **Server-side authorization is authoritative.** Frontend guards are UX only.
4. **Historical records are preserved.** Soft-delete where domain-appropriate.
5. **No secrets in code.** Local `.env` or `wrangler secret put`; never commit them.
6. **Small, reviewable changes.** One phase at a time.
7. **Tests are part of feature completion**, not an afterthought.
8. **Deployment is manual Wrangler only** — no Git-driven or CI deployment.

## Phase status

Phases 0–6 are complete (foundation, auth/RBAC, academic structure,
people/enrollment, timetable/attendance, assignments/resources).
Phase 7 (exams/results) has not started. See README §41/§51 for the
authoritative phase record.
