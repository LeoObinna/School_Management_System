# Plan — Total removal of PostgreSQL / Neon / Hyperdrive

## Context

The SMS runtime already migrated to Cloudflare D1 (Phases 1–3, 4b of the
D1 plan are complete; the application has been D1/SQLite-only since
2026-09-23). However, the codebase still carries PostgreSQL / Neon /
Hyperdrive as a "live staging fallback until Phase 6 D1 staging
acceptance":

- The `postgres` npm dependency and the `drizzle-orm/postgres-js` import graph.
- `[[hyperdrive]]` blocks in `wrangler.toml` (local + staging + production).
- A PG-only seed runner (`database/seed.ts`) and PG drizzle config
  (`drizzle.pg.config.ts`).
- An archived PG migration tree (`database/migrations/legacy-pg/`).
- PG-era decision records at the repo root that the master README already
  bars from being live guidance.
- Pervasive "retained until Phase 6" comments and a `DATABASE_URL` bridge
  in `server/plugins/cloudflare.ts` that no D1 runtime reads.

The user wants the database stack to focus purely on Cloudflare D1, so
this pass performs the decommission that the README had been deferring.
No production data exists; staging holds demo rows only. The change is
config + doc + dead-code deletion — no runtime behavior changes.

### User decisions captured
- Delete the four PG-era root docs: `MIGRATION_PLAN.md`,
  `ARCHITECTURE_DECISION_RECORD.md`,
  `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`, `MIGRATION_GAP_REPORT.md`
  (recoverable from git).
- `frontend/` Vue+Vite scaffold and `app/wrangler.pages.toml` stay for a
  separate pass — NOT touched here. (`wrangler.pages.toml` still contains
  `[[hyperdrive]]` text; flagged as known-deferred.)

## Files to change

### A. Active PG code — delete

1. `app/database/seed.ts` — entire PG seed runner (the D1 runner
   `seed-d1.ts` already exists and is the canonical path via
   `npm run db:d1:seed`).
2. `app/drizzle.pg.config.ts` — legacy PG drizzle config.
3. `app/database/migrations/legacy-pg/` — entire directory (4 SQL files +
   `meta/` journal + snapshots). Already superseded by the D1 baseline
   in `app/database/migrations/`.
4. The four PG-era root docs: `MIGRATION_PLAN.md`,
   `ARCHITECTURE_DECISION_RECORD.md`,
   `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`, `MIGRATION_GAP_REPORT.md`.

### B. Config files — edit

5. `app/wrangler.toml`
   - Delete top-level `[[hyperdrive]]` block (lines ~46–49) and its
     preceding local-dev comment block (lines ~27–45 is partly
     Hyperdrive-prose — rewrite to describe D1/R2/KV/Queues/Cron only).
   - Delete `[[env.staging.hyperdrive]]` block (lines ~101–107) and the
     staging Hyperdrive ID `f9399aef36f14ea4b41a1a5052c70f87`.
   - Delete `[[env.production.hyperdrive]]` block (lines ~144–150).
   - Strip `wrangler hyperdrive create …` lines from the staging and
     production provision-once comment headers; keep the D1/R2/KV/Queue
     create commands.

6. `app/package.json`
   - Remove `"postgres": "^3.4.5"` from `dependencies`.
   - Remove PG-only scripts: `db:pg:generate`, `db:pg:migrate`,
     `db:pg:push`, `db:pg:studio`.
   - Repoint the legacy aliases to the D1 tooling so the README's
     `npm run db:migrate` / `npm run db:seed` commands keep working:
     `db:migrate` → `npm run db:d1:migrate`, `db:seed` → `npm run db:d1:seed`.
   - Remove `db:push` and `db:studio` (drizzle-kit push/studio cannot
     target a D1 binding). Note this in README §31 commands.

7. `app/.env.example`
   - Delete the entire `--- Database (LEGACY PostgreSQL tooling) ---`
     block (lines ~21–40) including `DATABASE_URL` and
     `STAGING_DATABASE_URL` and the Postgres.app / Neon setup prose.
   - Replace with a short D1 note: "Database: local D1 binding (see
     `wrangler.toml` `[[d1_databases]]`); no env var needed."
   - Keep `SESSION_SECRET`, `SEED_PASSWORD`, `EXPOSE_RESET_TOKENS`,
     `NUXT_PUBLIC_API_BASE_URL`.

8. `app/.env` (gitignored, so edit carefully without printing secrets)
   - Remove the `STAGING_DATABASE_URL=…` line (and `DATABASE_URL=` if
     present). Leave `SESSION_SECRET` and other non-PG keys intact.

9. `app/nuxt.config.ts`
   - Remove the `databaseUrl: ''` runtimeConfig key (lines ~86) and the
     `// process.env at build time would ship DATABASE_URL/…` comment
     above it (only the DATABASE_URL part — keep the SESSION_SECRET
     reasoning).
   - Update the comment block at lines ~21, ~26 that mentions Hyperdrive
     to describe D1 only.

### C. Source comments — clean up stale "PG fallback" prose

10. `app/server/utils/db.ts` — rewrite the top docstring (lines 5–33):
    drop the "legacy Hyperdrive/postgres.js code paths were removed here
    in Phase 3; the HYPERDRIVE binding in wrangler.toml, the `postgres`
    dependency and database/seed.ts stay until Phase 6 (decommissioning)"
    paragraph; replace with a D1-only description. No code changes.

11. `app/server/plugins/cloudflare.ts`
    - Remove the `DATABASE_URL` bridge block (lines 58–66) and its
      comment. After this, the plugin only bridges `SESSION_SECRET` and
      `EXPOSE_RESET_TOKENS`.
    - Update the file header comment to drop the DATABASE_URL mention.

12. `app/database/seed-d1.ts` — drop the trailing "The legacy PostgreSQL
    runner lives in `seed.ts` and is retained only until Phase 6 removes
    the PG fallback" paragraph (lines 17–18).

13. `app/drizzle.config.ts` — drop the "The legacy PostgreSQL config …
    lives in `drizzle.pg.config.ts` … kept only as a fallback until D1
    staging passes acceptance (Phase 6)" paragraph (lines 16–20).

14. `app/database/schema/enums.ts` — rewrite the docstring (lines 4–30)
    to describe the `sqliteEnum` shim purely as a SQLite-CHECK helper,
    not as a "Phase 2 replacement of PostgreSQL pgEnum." Code unchanged.

15. `app/database/schema/{core,people,academics,enrollment}.ts` —
    rewrite the file-header "PostgreSQL to SQLite/D1: `pgTable` →
    `sqliteTable`…" migration notes to a one-line "SQLite/D1 schema for
    <domain>." description. Code unchanged.

16. `app/database/seeds/index.ts` — update the one comment about
    "PostgreSQL has no such cap" (line ~92) to "D1/SQLite caps bound
    variables at 100 per statement" only.

17. `app/server/services/{assignments,events,schedule,resources}.ts`,
    `app/server/utils/storage.ts`,
    `app/server/utils/images/gallery-thumbnails.ts`,
    `app/server/utils/http-errors.ts` — these have one-line comments
    mentioning "PostgreSQL metadata", "PostgreSQL's array_position",
    "PostgreSQL + SQLite/D1", "PostgreSQL (legacy Hyperdrive path):
    SQLSTATE 23505" etc. Rewrite each to say "D1/SQLite" or remove the
    parenthetical. **No code changes** — the `http-errors.ts`
    `isUniqueViolation`/`isForeignKeyViolation` already recognises both
    PG SQLSTATE 23505/23503 AND SQLite 2067/787; **keep both branches**
    (defensive, no cost) but drop the "legacy Hyperdrive path" framing
    from the comment.

18. `.trae/documents/phase-12-part-a-security-auth-hardening.md` line 229
    — single stray "No live PostgreSQL on the dev box" comment; rewrite
    to "No live D1 on the dev box" or leave (historical phase doc). Low
    priority; included for completeness.

### D. Documentation — rewrite for D1-only reality

19. `README.md` (master, ~3200 lines) — surgical edits to:
    - §1 Final architecture: drop the "PostgreSQL/Neon/Hyperdrive
      retained as live staging fallback ONLY until D1 staging passes
      acceptance (Phase 6)" lines and the note in the architecture text
      diagram (lines ~24–66).
    - §29 Environment strategy: rewrite the Local development, Remote
      managed services, Staging, Production subsections to describe D1
      only (drop Postgres.app, DATABASE_URL, Neon, Hyperdrive
      placeholders).
    - §30 Developer machine: drop Postgres.app / `createdb` references.
    - §31 Local setup: drop `DATABASE_URL`/Postgres.app setup steps;
      replace with `npm run db:d1:migrate && npm run db:d1:seed` flow;
      note `db:push` and `db:studio` scripts were removed.
    - §39 Cloudflare: remove the Hyperdrive subsection and the
      `wrangler hyperdrive create` provisioning commands; keep D1/R2/KV/
      Queues/Cron.
    - §40 Migration order: collapse to D1-only.
    - §41 Phase 13 entry: update to reflect that D1 staging acceptance is
      now the next milestone (Hyperdrive fallback is gone, so the
      staging cutover is purely D1 + DNS + TLS + backups).
    - §46 Current approved status: change the Database line to "D1
      (authoritative)"; drop the staging/production Hyperdrive/PG lines;
      add a "PostgreSQL/Neon/Hyperdrive: decommissioned (removed
      2026-09-24)" line.
    - §47 Architecture migration status: update the closing summary to
      reflect D1-only post-decommission.
    - §48 Architecture decision: drop the "PostgreSQL (via Hyperdrive)"
      mention in the approved direction.
    - §51 Change log: append a new entry dated 2026-09-24 describing
      this decommission pass (what was removed, what was edited, gates
      re-run).
    - §52 Migration status: flip "PostgreSQL decommissioned only AFTER
      D1 staging passes acceptance" → "PostgreSQL/Neon/Hyperdrive
      decommissioned 2026-09-24; D1 is the sole database engine."

20. `PROJECT_RULES.md` — update the header to D1-only; remove the
    `DATABASE_URL`, Hyperdrive, Neon mentions in the environment and
    commands sections.

21. `.trae/rules/project_rules.md` — same updates as PROJECT_RULES.md.

22. `docs/DATABASE.md` — rewrite to be D1-only: local D1 via
    `wrangler.toml` + `getPlatformProxy`, remote D1 via `wrangler d1
    migrations apply --remote -e staging|production`, Drizzle SQLite
    core, INTEGER kobo, ×100 scores, TEXT ISO timestamps, TEXT UUIDs,
    TEXT+CHECK enums. Drop all PostgreSQL/Neon/Hyperdrive/`DATABASE_URL`
    content.

23. `docs/CLOUDFLARE.md` — remove the Hyperdrive row from the products
    table and the standalone Hyperdrive section (lines ~78–87); keep
    D1/R2/KV/Queues/Cron content.

### E. NOT touched (per user decision)
- `frontend/` Vue+Vite scaffold — separate pass.
- `app/wrangler.pages.toml` — separate pass. Note: it still contains
  `[[hyperdrive]]` text but is not loaded by Wrangler; flag in the
  change-log entry as a known-deferred artifact.

## Verification

Run from `app/` after edits:

1. `npm install` — confirm `postgres` removed from `node_modules`.
2. `npm run type-check` — nuxt typecheck must exit 0.
3. `npm run test` — vitest must stay green (current baseline per README
   §51 latest entry is 495/495 across 37 files; expect unchanged).
4. `npm run build` — cloudflare-module Worker build must exit 0.
5. `npx wrangler deploy --dry-run` — config valid; no Hyperdrive blocks
   referenced.
6. `npm run db:d1:migrate && npm run db:d1:seed` — D1 path still works
   end-to-end against local Miniflare D1.
7. `npm run cf:dev` smoke (port 8787):
   - `GET /api/v1/health` → `{ database: true }`.
   - Login as `admin@victoriouschildren.school` → 200.
   - `GET /api/v1/users` → 200 (RBAC + D1 group_concat still works).
8. `grep -ri "hyperdrive\|HYPERDRIVE\|postgres\|PostgreSQL\|Neon\|DATABASE_URL\|STAGING_DATABASE_URL" app/server app/database app/wrangler.toml app/package.json app/.env.example app/nuxt.config.ts PROJECT_RULES.md README.md docs/DATABASE.md docs/CLOUDFLARE.md .trae/rules/project_rules.md` — should return zero hits except for the README §51 change-log entry describing the removal.

## Known limitations / follow-ups
- `frontend/` scaffold and `app/wrangler.pages.toml` removal: separate
  pass (user decision).
- No remote D1 is provisioned yet; staging/production D1 IDs in
  `wrangler.toml` remain placeholders — these are filled in during the
  actual staging cutover (SMS Phase 13), not in this pass.
- README §51 entry will note that `postgres` dependency removal
  requires a fresh `npm install` to take effect on a deployed Worker.
