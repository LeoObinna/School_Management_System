# Architecture

Status: **Phase 0 — cloud-first foundation.** No backend or business modules yet.

## Overview

``` text
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

## Stack

| Concern         | Technology                                     |
|-----------------|------------------------------------------------|
| Frontend        | Vue 3, TypeScript, Vite 8, Pinia 3, Tailwind 4 |
| Backend         | Laravel 12, PHP 8.4+, Sanctum, Eloquent         |
| Database        | PostgreSQL 16                                   |
| Cache/queues    | Redis 7                                         |
| Object storage  | Cloudflare R2 (S3-compatible)                   |
| Edge/security   | Cloudflare DNS, TLS, WAF                        |
| Source control  | Git + GitHub                                    |
| CI/CD           | GitHub Actions                                  |
| Dev environment | GitHub Codespaces (.devcontainer/)             |
| IDE             | TRAE CN                                         |

## Development environment

All development happens in **GitHub Codespaces**. The
`.devcontainer/` folder defines:

- **app** container: PHP 8.4 + Composer + Node 24 + GitHub CLI
- **db** service: PostgreSQL 16 (Alpine)
- **redis** service: Redis 7 (Alpine)

See [CODESPACES.md](./CODESPACES.md) for setup and [FRONTEND.md](./FRONTEND.md)
for frontend details.

## Repository structure

``` text
School_Management_System/
├── README.md                    # Master spec (authoritative)
├── PROJECT_RULES.md             # Hard rules for TRAE
├── .env.example                 # Root env template (cloud-first)
├── .gitignore
├── .devcontainer/
│   ├── devcontainer.json        # Codespace definition
│   ├── docker-compose.yml       # app + db + redis
│   ├── Dockerfile               # PHP 8.4 + Node 24 + Composer
│   └── post-create.sh           # Auto-setup script
├── .github/
│   └── workflows/ci.yml         # Frontend + backend CI
├── .trae/rules/
│   └── project_rules.md         # TRAE operating rules
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   ├── CODESPACES.md
│   ├── CLOUDFLARE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── TESTING.md
│   ├── SECURITY.md
│   └── FRONTEND.md
├── frontend/                    # Vue 3 + TS + Vite
└── backend/                     # (future) Laravel 12 API
```

## Principles

1. **PostgreSQL is the source of truth.** Redis is cache/queue only.
2. **R2 for objects, PostgreSQL for metadata.** Never store files in the DB.
3. **Server-side authorization is authoritative.** Frontend guards are UX only.
4. **Historical records are preserved.** Soft-delete where domain-appropriate.
5. **No secrets in code.** Use Codespace Secrets / GitHub Secrets.
6. **Small, reviewable changes.** One phase at a time.
7. **Tests are part of feature completion**, not an afterthought.

## Phase status

- **Phase 0** (Infrastructure): Frontend scaffold complete. Devcontainer
  and CI created. Backend not yet scaffolded.
- **Phase 1+**: Not started.
