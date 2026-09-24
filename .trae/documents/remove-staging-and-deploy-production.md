# Remove Staging + Deploy to Cloudflare D1/R2 (Production)

## Context

The D1 migration is complete in code: since Phase 3 (commit `1ede088`) the runtime is
D1/SQLite-only, and the latest commit `16cddbb project necessary change` already removed
`app/drizzle.pg.config.ts` and `database/migrations/legacy-pg/`. Phases 1–13 + Phase 7
Option B are all done locally with green gates (typecheck 0, vitest 495/495, build OK).

The staging Worker (`sms-staging`) is the only thing still on PostgreSQL (Neon +
Hyperdrive), kept as a fallback per the old Phase-14 plan. Production
(`sms-production`) has never been provisioned — `wrangler.toml` still has
`REPLACE_WITH_PRODUCTION_D1_ID` placeholders.

**Owner decision (2026-09-24, revised):** drop the staging tier from the codebase
and deploy a single production environment on Cloudflare D1 + R2. This means:
- Remove the `staging` env from config/code/docs.
- Leave the live `sms-staging` Cloudflare Worker + `sms-staging` D1/R2/KV/Queue +
  Hyperdrive `sms-pg-staging` + Neon `sms_staging` PG database **untouched and
  running dormant** — owner reversed on remote-resource deletion. They can be
  cleaned up manually later if desired.
- Provision production D1/R2/KV/Queue, apply migrations remotely, seed demo data,
  set `SESSION_SECRET`, build + deploy `sms-production`.
- Delete the legacy `app/wrangler.pages.toml` (local file only; no remote impact).

The user wants to be guided through the process. Several steps require the user's own
`wrangler login` (browser auth, fresh token with R2/Queues scopes) so they run those
commands in their Terminal; I make the code/config/doc edits and help paste real IDs
back into `wrangler.toml`.

## Approach

### Part A — Code/config/doc edits (I make these, no remote calls)

**A1. `app/wrangler.toml`** — collapse to local + production only.
- Delete the entire `[env.staging]`, `[[env.staging.d1_databases]]`,
  `[[env.staging.r2_buckets]]`, `[[env.staging.kv_namespaces]]`,
  `[env.staging.triggers]]`, `[[env.staging.queues.producers]]`,
  `[[env.staging.queues.consumers]]` blocks.
- Update the header comment block (lines 1–15) to drop `npm run deploy:staging`.
- Update the production block comments to remove the "Do NOT provision earlier —
  production stays untouched until D1 staging acceptance is signed off" gate
  (staging is gone, no gate).
- Update the Queues provisioning comment (lines 134–142) to drop the
  `wrangler queues create sms-notifications-staging` line.
- Update local-mode comment (lines 28–36) to drop "do NOT use --remote before staging
  cutover" wording.
- Keep production placeholders (`REPLACE_WITH_PRODUCTION_D1_ID`,
  `REPLACE_WITH_PRODUCTION_EDGE_KV_ID`) — Part B fills them in.

**A2. `app/package.json`** — drop the staging script.
- Remove `"deploy:staging": "npm run build && wrangler deploy -e staging"`.
- Keep `deploy:production`.

**A3. Delete `app/wrangler.pages.toml`** — legacy Pages config, references staging,
not loaded by Wrangler. Use `DeleteFile`.

**A4. Update staging mentions in code comments** (cosmetic, no behavior change):
- `app/server/utils/storage.ts` line 12 — change "staging or production (Phase 13
  wires envs)" → "production".
- `app/server/utils/db.ts` line 11 — change "staging/production, `wrangler dev`,
  queue" → "production, `wrangler dev`, queue".
- `app/server/utils/notifications-queue.ts` line 13 — change "Phase 13
  staging-review follow-up" → "Phase 13 follow-up".
- `app/server/api/v1/report-cards/[id]/pdf.get.ts` line 24 — change "run via
  `npm run cf:dev` or staging" → "run via `npm run cf:dev`".
- `app/drizzle.config.ts` line 11 — change "--remote --env staging|production"
  → "--remote --env production".
- `app/nuxt.config.ts` line 89 — change "NEVER enabled in staging/prod" →
  "NEVER enabled in production".
- `app/server/middleware/01.security-headers.ts` line 13 — change "Phase 13
  staging-review follow-up" → "Phase 13 follow-up".

**A5. `app/.env.example`** — drop staging mentions:
- Line 4: "Production/staging secrets are set with `wrangler secret put`" →
  "Production secrets are set with `wrangler secret put -e production`".
- Line 26: "Never true in staging/prod." → "Never true in production."
- Line 28 (header comment): same treatment.

**A6. `PROJECT_RULES.md`** — rewrite the staging sections:
- Lines 65–74 ("Staging and production run on Cloudflare Workers..."): collapse to
  a single production environment paragraph; drop the `deploy:staging` example.
- Lines 81–83 ("staging/production secrets are stored with `wrangler secret put
  -e <env>`"): simplify to production only.

**A7. `README.md`** — large doc update per owner's standing preference
("update the master README with completed phase, decisions, architecture changes,
and current status; do not create another README"). Survey found ~50 staging
references. Concretely:
- §Deployment (lines 764, 794–805): collapse the LOCAL→STAGING→PRODUCTION ladder to
  LOCAL→PRODUCTION; delete the "### Staging" subsection.
- §Commands (lines 926, 939, 942, 1050, 1055, 1056): drop `deploy:staging` and the
  `-e staging --remote` migration example.
- §Provisioning (lines 1023–1029): drop the `wrangler d1 create sms-staging` block,
  keep `sms-production` equivalents.
- §STAGING STATUS block (lines 1037–1039): replace with a PRODUCTION STATUS block
  describing the post-deploy state once Part B finishes.
- §Observability (lines 1068, 1073, 1077, 1094, 1097): swap `sms-staging` /
  `-e staging` for `sms-production` / `-e production`.
- §Pending/provisioning checklist (lines 1765–1774, 1781): rewrite as production-only.
- §Constraints (line 167 "no real student data in fixtures/staging", line 2016
  "development/staging"): reword to "development" or "non-production".
- §Changelog (lines 2166, 2173, 2177, 2190, 2286–2299): leave historical entries
  intact (they describe past state) but append a new dated entry documenting the
  staging removal + production cutover decision.
- The deployment ladder diagrams (lines 1008, 1017): redraw LOCAL→PRODUCTION.

**A8. Memory updates** — append to
`/Users/mac/.trae-cn/memory/projects/-Users-mac-Documents-School-Management-System--p2-5725c9cec174889c2349/project_memory.md`
a note that staging tier is removed (supersedes the "live PG staging" hard
constraint from 2026-09-20). Per user's "remember my xxx" convention this is
project-level info.

**A9. Run gates after Part A edits** (per project rule step 7):
- `npm run type-check` (expect 0 errors)
- `npm run test` (expect 495/495 — no test touches staging env)
- `npm run build` (expect EXIT 0, cloudflare-module preset, no wrangler in `.output`)

### Part B — Remote provisioning + deploy (user runs in Terminal; I guide)

The user must run these because `wrangler login` needs browser auth and the user's
old token lacks R2/Queues scopes (per project memory). I provide exact commands and
paste the returned IDs into `wrangler.toml`.

**B1. Fresh wrangler login** (user):
```
npx wrangler login
```
Re-authorize when prompted. Confirm with `npx wrangler whoami`.

**B2. Provision production Cloudflare resources** (user runs each; paste IDs back):
```
npx wrangler d1 create sms-production
npx wrangler r2 bucket create sms-production
npx wrangler kv namespace create sms-edge-production
npx wrangler queues create sms-notifications-production
```
- The `d1 create` output prints a `database_id`; the `kv namespace create` output
  prints an `id`. User pastes both to me; I update `app/wrangler.toml`:
  - `[[env.production.d1_databases]].database_id` ← real D1 id
  - `[[env.production.kv_namespaces]].id` ← real KV id

**B3. Set production secret** (user):
```
npx wrangler secret put SESSION_SECRET -e production
```
Paste a long random value (e.g. output of `openssl rand -base64 48`). Per project
rule: SESSION_SECRET must stay stable across redeploys to prevent logouts; store
the value somewhere safe (password manager).

**B4. Apply D1 migrations remotely** (user):
```
cd app && npx wrangler d1 migrations apply DB -e production --remote
```
Expect 125 DDL commands applied (matches the local baseline migration
`0000_overrated_marvel_apes.sql`).

**B5. Seed production D1 with demo data** (the technical wrinkle: `seed-d1.ts`
uses `getPlatformProxy` which is local-only emulation — it cannot talk to remote
D1 directly). Workaround, no code change required:
1. Make sure local D1 is freshly migrated + seeded (idempotent):
   ```
   cd app && npm run db:migrate && npm run db:seed
   ```
2. Export the local D1 data to a SQL dump:
   ```
   npx wrangler d1 export DB --local --output=.tmp/prod-seed.sql
   ```
3. Filter the dump to INSERT rows only (strip `CREATE TABLE`, `CREATE INDEX`,
   `PRAGMA`, and the `d1_migrations` tracking rows) and apply to remote:
   ```
   # keep only INSERT INTO <real_table> lines
   grep -E '^INSERT INTO' .tmp/prod-seed.sql | grep -v 'INSERT INTO d1_migrations' > .tmp/prod-seed-inserts.sql
   npx wrangler d1 execute DB -e production --remote --file=.tmp/prod-seed-inserts.sql
   ```
4. Delete the temp files: `rm -rf app/.tmp`.

This imports the exact demo rows (admin@victoriouschildren.school / password123,
teacher, student STU-001 Amara Okafor, parent Ngozi, etc.) with their app-generated
UUIDs intact. Idempotent: re-running seed-then-export-then-import is safe because
the seed uses `onConflictDoUpdate` / `INSERT OR REPLACE`.

**B6. Build + deploy production Worker** (user, after I confirm IDs are in place):
```
cd app && npm run deploy:production
```
This runs `npm run build` (Nitro cloudflare-module preset → `.output/server/index.mjs`
+ `.output/public`) then `npx wrangler deploy -e production`. Note the deploy URL
printed at the end (`https://sms-production.<subdomain>.workers.dev` or the custom
domain if routed).

### Part C — Smoke verification (user runs, I help interpret)

Against the deployed production URL:
```
curl -s https://sms-production.<subdomain>.workers.dev/api/v1/health
# expect {"status":"ok","database":true,...}

curl -s -c /tmp/c.txt -b /tmp/c.txt -X POST https://sms-production.<subdomain>.workers.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'x-csrf-token: <sms_csrf cookie value>' \
  -d '{"email":"admin@victoriouschildren.school","password":"password123"}'
# expect 200 + Set-Cookie sms_session; user is super_admin (104 perms)

curl -s -b /tmp/c.txt https://sms-production.<subdomain>.workers.dev/api/v1/auth/me
# expect admin profile with 104 permissions

curl -s -b /tmp/c.txt https://sms-production.<subdomain>.workers.dev/api/v1/users
# expect paginated user list (admin gap Phase 6)

curl -s -b /tmp/c.txt https://sms-production.<subdomain>.workers.dev/api/v1/reports/admissions
# expect admissions pipeline report (Phase 13)
```

If any fail, inspect logs: `npx wrangler tail sms-production`.

### Part D — Staging remote resources (intentionally NOT deleted)

Per owner revision (2026-09-24), the live `sms-staging` Cloudflare Worker + D1 +
R2 + KV + Queue + Hyperdrive `sms-pg-staging` + Neon `sms_staging` PG database
are **left untouched and running dormant**. They are simply no longer referenced
by the codebase (the `[env.staging]` block is gone from `wrangler.toml`, the
`deploy:staging` script is gone from `package.json`). If the owner later wants to
decommission them, the commands are:

```
npx wrangler delete --name sms-staging
npx wrangler d1 delete sms-staging
npx wrangler r2 bucket delete sms-staging                   # bucket must be empty
npx wrangler kv namespace delete --namespace-id=4e6311207ab94649a6f08f00f572d14f
npx wrangler queues delete sms-notifications-staging
npx wrangler hyperdrive delete sms-pg-staging
# Neon sms_staging PG: delete via Neon dashboard (not a wrangler command)
```

These are out of scope for this task.

## Critical files to modify

| File | Change |
|------|--------|
| `app/wrangler.toml` | Remove `[env.staging]` block + staging comments; Part B fills prod IDs |
| `app/package.json` | Remove `deploy:staging` script |
| `app/wrangler.pages.toml` | Delete (legacy) |
| `app/server/utils/storage.ts`, `db.ts`, `notifications-queue.ts`, `app/server/api/v1/report-cards/[id]/pdf.get.ts`, `app/drizzle.config.ts`, `app/nuxt.config.ts`, `app/server/middleware/01.security-headers.ts` | Update staging→production in comments only |
| `app/.env.example` | Drop staging mentions in comments |
| `PROJECT_RULES.md` | Collapse staging+production sections to production-only |
| `README.md` | ~50 staging references updated; new changelog entry; staging ladder→LOCAL→PRODUCTION |
| `…/project_memory.md` | Append staging-removed supersession note |

## Verification

End-to-end test after Part B + C:
1. `npm run type-check` → 0 errors
2. `npm run test` → 495/495
3. `npm run build` → EXIT 0
4. `npx wrangler d1 execute DB -e production --remote --command="SELECT count(*) FROM users"` → returns demo user count
5. `GET /api/v1/health` on deployed URL → `database:true`
6. Login + `/auth/me` + `/users` + `/reports/admissions` all 200
7. `npx wrangler deployments list -e production` → shows the new deploy
8. Staging Worker `sms-staging` left untouched (still deployed, still on PG) —
   confirmed by `npx wrangler deployments list -e staging` returning the old
   deploy. Not an error condition per owner decision.

## Known limitations / risks

- **`wrangler d1 export --local`** format: if the dump shape differs (e.g. wraps
  INSERTs in transactions), the grep filter may need adjusting. Fallback: hand-edit
  the dump, or run the seed SQL through `wrangler d1 execute` statement-by-statement.
- **Staging remote resources remain live** per owner revision — the dormant
  `sms-staging` Worker + Neon `sms_staging` PG keep running (and may incur Neon
  free-tier compute) until manually decommissioned via the Part D reference commands.
- **Smoke seed uses demo accounts with a known password** (`password123`). Before
  going truly live, either wipe `sms-production` D1 and re-seed with real data, or
  rotate all demo passwords. Per project rule: "never use real student data in
  fixtures" — demo seed is fake data only.
- **SESSION_SECRET** must be stored durably (password manager); losing it invalidates
  all sessions on next deploy.
- **Custom domain / TLS / WAF** on the real `victoriouschildren.school` domain is
  out of scope for this task — that's a follow-up DNS/routing step.
