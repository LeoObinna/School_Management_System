# TRAE Project Rules — Local Development + Cloudflare Workers

## Environment

Development runs **locally** on the Mac (Node 24 + npm). There is no
Codespace, devcontainer, Docker, Redis, PHP, or Composer. Cloudflare D1
(SQLite) is the database in every environment, reached locally via
`wrangler getPlatformProxy({ persist: true })` against the `DB` binding
declared in `app/wrangler.toml`. No connection string is required.

All Cloudflare deployments are **manual Wrangler deploys from the local
terminal** (`npm run deploy:staging` / `npm run deploy:production` from
`app/`). GitHub is source control/version history only — never configure
GitHub Actions deployment, Cloudflare Pages Git integration, or Workers
Builds.

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
-   hard-code secrets — use local `.env` (gitignored) or
    `wrangler secret put -e <env>`
-   commit `.env`, `.dev.vars` or credentials
-   use real student data in fixtures/staging
-   expose private files publicly
-   trust client-supplied roles, permissions or payment status
-   delete historical academic records merely because a student leaves
-   introduce duplicate models/routes/migrations
-   build the public website before the SMS foundation is stable
-   require PHP/Composer/Redis/Docker/Codespaces — development is local
    Node 24 + the local D1 binding
-   configure GitHub Actions deploys, Pages Git integration, or Workers
    Builds — all deploys are manual `wrangler deploy` from the Mac
-   run database migrations through Hyperdrive or any direct DB
    connection string — use `npm run db:migrate` (wrangler d1
    migrations apply DB --local)

## Commands (local machine, from `app/`)

```bash
npm install          # install dependencies
npm run dev          # Nuxt dev server (Node; D1 via wrangler getPlatformProxy)
npm run cf:dev       # build + wrangler dev (Workers emulation + bindings)
npm run test         # Vitest
npm run type-check   # nuxt typecheck
npm run build        # cloudflare-module Worker build
npm run db:migrate   # wrangler d1 migrations apply DB --local
npm run db:seed      # seed fake demo data via D1 (never real student data)
npm run deploy:staging     # build + wrangler deploy -e staging
npm run deploy:production  # build + wrangler deploy -e production
```

## Architecture

- Frontend + API: Nuxt 4 (Vue 3 + TypeScript) + Nitro server routes
- Runtime: Cloudflare Workers + Static Assets (cloudflare-module preset)
- Database: Cloudflare D1 (SQLite) in every environment; Drizzle ORM
  SQLite dialect; INTEGER kobo for money; local dev via wrangler
  getPlatformProxy against the D1 binding in wrangler.toml
- Storage: Cloudflare R2 via R2_BUCKET binding (metadata in D1)
- Background: Cloudflare Queues + Cron Triggers (from Phase 10)
- Edge: Cloudflare DNS, TLS, WAF, rate limiting
- Source control: GitHub (version history only; no Git-driven deploys)
- Deployment: manual Wrangler from the local Mac (named envs in
  `app/wrangler.toml`: staging, production)

## Secrets

Never commit secrets. Use:

1.  **Local dev:** `app/.env` (gitignored), copied from
    `app/.env.example`.
2.  **Staging/production:** `wrangler secret put <NAME> -e staging|production`
    (or the Cloudflare dashboard). Never place secrets in
    `wrangler.toml`.
3.  `.env.example` files are the only env files that may be committed.
