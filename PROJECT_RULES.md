# PROJECT RULES

```text
Mission: production-ready School Management System.
Frontend: Vue 3 + TypeScript + Vite.
Backend: Laravel 12 API.
Database: PostgreSQL.
Cache/queues: Redis.
Storage: Cloudflare R2.
Dev environment: GitHub Codespaces (.devcontainer/).

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript.
Use reusable components.
Use Form Requests for non-trivial validation.
Use Policies/Gates for authorization.
Use Services/Actions for multi-step domain workflows.
Use database transactions for multi-write operations.
Use PostgreSQL as the source of truth.
Use R2 for objects, PostgreSQL for file metadata.
Keep controllers thin.
Never hard-code secrets or school policy.
Never trust client authorization claims.
Preserve historical records.
Add tests for critical behavior and authorization boundaries.
Run tests, type checks, lint and build before completing a phase.
Document architectural deviations.
```

## Cloud-first development — approved approach

Development happens in **GitHub Codespaces**, not on the local Mac.
The `.devcontainer/` folder defines a container with PHP 8.4, Composer,
Node 24, PostgreSQL 16 and Redis 7. The Mac is a thin client: it only
needs TRAE CN, a browser, and a GitHub account.

No local PHP, Composer, PostgreSQL, Redis, Docker, Herd, Postgres.app,
Valkey or Homebrew is required. The previous local-dev deviation (Herd,
Postgres.app, Valkey) is superseded.

Staging and production use managed PostgreSQL, Redis and R2 buckets with
separate credentials. Never commit secrets — use Codespace Secrets or
GitHub repository secrets.
