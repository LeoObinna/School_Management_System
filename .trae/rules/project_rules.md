# TRAE Project Rules — Cloud-First Development

## Environment

This project uses **GitHub Codespaces** for development. The local Mac
(2017 Intel MacBook, macOS 13, 8GB RAM) is a thin client — it runs only
TRAE CN, a browser, and optionally Git.

All development infrastructure (PHP, Composer, Node, PostgreSQL, Redis)
runs inside the Codespace via `.devcontainer/`. See `docs/CODESPACES.md`.

## TRAE Operating Rules

Before every change TRAE must:

1.  Read `README.md` and `PROJECT_RULES.md`.
2.  Inspect the repository and existing implementation.
3.  Identify the current phase.
4.  Make a small implementation plan.
5.  Implement only the approved phase/task.
6.  Add/update tests.
7.  Run relevant checks (see Commands section below).
8.  Update documentation.
9.  Report files, migrations, endpoints, tests and known limitations.

## Never

-   invent requirements
-   overwrite unrelated work
-   rewrite the project unnecessarily
-   bypass authorization
-   hard-code school policies, fees or grading rules
-   hard-code secrets — use Codespace Secrets or GitHub Secrets
-   commit `.env` or credentials
-   use real student data in fixtures/staging
-   expose private files publicly
-   trust client-supplied roles, permissions or payment status
-   delete historical academic records merely because a student leaves
-   introduce duplicate models/routes/migrations
-   build the public website before the SMS foundation is stable
-   require local PHP/Composer/PostgreSQL/Redis on the Mac — all
    development happens in Codespaces
-   commit `.devcontainer/post-create.sh` with real secrets

## Commands (inside Codespace)

```bash
# Frontend
cd /workspace/frontend
npm install
npm run dev          # Vite dev server on :5173
npm run test         # Vitest
npm run type-check   # vue-tsc
npm run build        # production build

# Backend (when scaffolded)
cd /workspace/backend
composer install
php artisan serve    # Laravel API on :8000
php artisan test     # Pest/PHPUnit
php artisan tinker
php artisan migrate
php artisan db:seed
```

## Architecture

- Frontend: Vue 3 + TypeScript + Vite + Pinia + Tailwind
- Backend: Laravel 12 API + Sanctum
- Database: PostgreSQL 16 (in Codespace via docker-compose)
- Cache/queues: Redis 7 (in Codespace via docker-compose)
- Storage: Cloudflare R2
- Edge: Cloudflare DNS, TLS, WAF
- Source control: GitHub
- CI: `.github/workflows/ci.yml`
- Dev container: `.devcontainer/`

## Secrets

Never commit secrets. Use:

1.  **Codespace Secrets** (GitHub Settings → Codespaces → Secrets) for
    dev credentials (R2 keys, API tokens). These are injected as
    environment variables automatically.
2.  **GitHub repository secrets** for CI/CD.
3.  `.env.example` files are the only env files that may be committed.
