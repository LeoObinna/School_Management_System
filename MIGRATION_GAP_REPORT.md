# VICTORIOUS CHILDREN SCHOOL — MIGRATION / GAP REPORT (POPULATED)

**Date:** 2026-09-21
**Prepared by:** TRAE (senior-engineer pass, read-only inspection — no code was changed)
**Inputs:** package v2.0 (`README.md`, `01_PRD.md` … `06_IMPLEMENTATION_PLAN.md`, `TRAE_STRICT_COMPLIANCE_PROMPT.md`, template `07`) + full inspection of the working repository on `main`.
**Status:** PHASE 0 CHECKPOINT — AWAITING OWNER APPROVAL. No destructive changes made.

> **Headline:** The repository is *not* a Laravel/PHP legacy. It is already a mature, tested **Nuxt 4 + Cloudflare Workers + R2 + KV + Queues** application (~48k LOC, 217 API route files, 630 passing test cases). The migration to the v2.0 target is therefore **~85% KEEP/ADAPT at the application layer** and a focused, but deep, **database-engine replacement: PostgreSQL/Neon/Hyperdrive/Drizzle-pg → Cloudflare D1/SQLite**, plus three genuinely new builds (Paystack, public website, a handful of missing tables/portals).

---

## 1. Current Project

- **Framework:** Nuxt 4.5 (`app/` as srcDir), Vue 3.5, TypeScript ~6.0, Pinia 3 (manual plugin), Zod 3.24.
- **Frontend:** Tailwind CSS v4 via Vite plugin; 29 Vue pages under [pages/](file:///Users/mac/Documents/School_Management_System/app/pages), Pinia auth store, global route guard, typed client services in [services/](file:///Users/mac/Documents/School_Management_System/app/services). Portal/management UI only — **no public marketing website exists**.
- **Backend:** Nitro server routes, **217 route files** under [server/api/v1/](file:///Users/mac/Documents/School_Management_System/app/server/api/v1) covering auth, students, parents, teachers, staff, classes, sections, subjects, sessions/terms, enrollments, attendance, exams/results/report-cards, fees/invoices/payments, admissions, assignments, resources, timetable, announcements, messages, notifications, events, gallery, reports, audit logs, school settings, health. 14 service modules, ~11,400 LOC in [server/services/](file:///Users/mac/Documents/School_Management_System/app/server/services).
- **Database:** PostgreSQL 16 local (Postgres.app, `sms_dev`, trust auth); staging on **Neon PG 18** (live Worker `sms-staging`, db=true, login verified 2026-09-20). **52 tables** in 12 Drizzle schema files; 4 Drizzle migrations ([0000](file:///Users/mac/Documents/School_Management_System/app/database/migrations/0000_clever_garia.sql) = 892 lines).
- **ORM:** Drizzle ORM 0.39, **postgres-js dialect**; driver `postgres` 3.4. Central data layer [server/utils/db.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/db.ts) builds a per-request client from the **HYPERDRIVE** binding in Workers and a process pool from `DATABASE_URL` in `nuxt dev`.
- **Storage:** Cloudflare R2 via `R2_BUCKET` binding only ([storage.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/storage.ts)); metadata in PostgreSQL; private objects streamed through authorized routes; magic-byte upload validation; jsquash WASM thumbnails; pdf-lib report cards/audit certificates; xlsx import/export.
- **Edge runtime:** Nitro preset **cloudflare-module** (Worker + Static Assets, [.output/server/index.mjs](file:///Users/mac/Documents/School_Management_System/app/nuxt.config.ts)); KV namespace `EDGE_KV` (rate limiter + session revocation); Queues `sms-notifications-*` (idempotent announcement fan-out); Cron `*/5` publishing scheduled announcements; security-headers middleware (HSTS, nosniff, frame DENY, COOP, CSP report-only, etc.).
- **Auth/security:** stateless HMAC-signed cookie sessions + CSRF double-submit + KV revocation; PBKDF2-HMAC-SHA-512 (100k, WebCrypto); login/reset throttling; 5 roles (`super_admin, admin, teacher, student, parent`) and **104 permission slugs** in [catalog.ts](file:///Users/mac/Documents/School_Management_System/app/database/seeds/catalog.ts); row-scope enforcement (teacher↔assigned class/subject, parent↔linked child); audit logging.
- **Payments:** cash / bank transfer / card / cheque / online-gateway *methods modeled*, but **no payment gateway exists** — payments are manually recorded and explicitly verified ([finance.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/finance.ts), `recordPayment/verifyPayment/refundPayment`); receipts generated to R2. **No Paystack code anywhere.**
- **Deployment:** manual Wrangler 4 from the Mac, named envs `staging`/`production` in [wrangler.toml](file:///Users/mac/Documents/School_Management_System/app/wrangler.toml); GitHub is source control only.
- **Cloudflare configuration:** `[assets]` Static Assets, `[[hyperdrive]]` local placeholder + staging id `f9399aef…`, R2 buckets per env, EDGE_KV per env, Queues producer/consumer per env, crons. Old Pages file retained as [wrangler.pages.toml](file:///Users/mac/Documents/School_Management_System/app/wrangler.pages.toml).
- **Tests:** Vitest 5 + jsdom; 31 test files / ~630 cases (shared zod schemas, money, auth utils, service logic, RBAC, scoping, PDF, thumbnails, queue dispatch). Unit-level; **no database-backed integration suite**.
- **Git state at inspection:** branch `main`, last commit `64787e7 "completed phase 13 A"`. Uncommitted: modified `README.md`, seeds, shared schemas/types, `docs/API.md`; untracked school-settings feature; untracked copies of the seven v2.0 specs, this package's prompt and a duplicate `"README 2.md"` at repo root. No production data exists anywhere; staging holds demo data only.

## 2. Target

```text
Nuxt 4 / Vue 3 / TypeScript / Tailwind / Nitro     ← already in place
Cloudflare Worker + Static Assets                   ← already in place
Cloudflare R2                                       ← already in place (binding only)
Cloudflare KV                                       ← already in place (rate limit + revocation)
Wrangler (manual deploys, env separation)           ← already in place
Cloudflare D1                                       ← REPLACES PostgreSQL/Neon/Hyperdrive
Paystack                                            ← NET-NEW (init + webhook + verify + ledger)
Cloudflare DNS/domain                               ← deferred decision (no production cut yet)
Git/GitHub (source control only)                    ← already in place
```

## 3. KEEP

| Area | Existing implementation | Reason | Changes |
|---|---|---|---|
| Nuxt/Vue/TS/Tailwind shell | Nuxt 4.5 app, Pinia, Tailwind v4, global guard, [app.vue](file:///Users/mac/Documents/School_Management_System/app/app.vue), [middleware/auth.global.ts](file:///Users/mac/Documents/School_Management_System/app/middleware/auth.global.ts) | Exact target stack | None structurally; brand tokens later per UI brief |
| 29 portal pages + components/composables | students, teachers, parents, attendance, exams/results, fees/invoices, admissions, timetable, gallery, announcements, settings… | Working admin/teacher UX matches PRD admin/teacher sections | Money input handling adapted (integer kobo); theme tokens checked against brief |
| 217 Nitro route files | `server/api/v1/**` REST handlers, uniform `{data,meta}` envelope | Route groups already match TRD §14 (`/api/students/*`, `/api/fees/*` …) | Only DB-facing calls change; route paths/contracts stay |
| Service-layer business logic | 14 modules, ~11.4k LOC (slugs, single-current session/term, result workflow DRAFT→SUBMITTED→APPROVED→PUBLISHED, invoice lifecycle, admissions pipeline, timetable clash checks) | Business rules are database-agnostic and already encode README §13–§22 + v2.0 AppFlow critical rules | Query dialect adapted (§7 below); no workflow redesign |
| Password hashing | [password.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/password.ts) PBKDF2-SHA512 WebCrypto, parameterized format | Runtime-portable, Workers-capable, upgradeable | None |
| Sessions / CSRF / cookies / tokens | [session-service.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/session-service.ts), tokens, cookies, [00.auth.ts](file:///Users/mac/Documents/School_Management_System/app/server/middleware/00.auth.ts) | Crypto-only; meets directive §9 (HttpOnly/Secure/SameSite, expiry, logout/revocation, reset, status) | None (sessions are stateless signed cookies — see decision D4) |
| RBAC + scoping guards | [rbac.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/rbac.ts), permissions, actor, context; 104-slug catalog | Server-side authority already enforced; matches/extends TRD §10 permission list | None (keep join-table model — decision D3) |
| KV rate limiter + revocation | [edge-kv.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/edge-kv.ts), throttle, revocation, edge-rate-limit | KV used exactly as directive §11 prescribes (non-authoritative) | None |
| Security headers middleware | [01.security-headers.ts](file:///Users/mac/Documents/School_Management_System/app/server/middleware/01.security-headers.ts) | Already edge-native | None |
| R2 file services | storage, multipart, uploads, magic-byte sniffing, authorized streaming | Binding-based; identical on D1 architecture | Only metadata queries change with schema |
| Images / PDF / xlsx | jsquash WASM thumbnails, pdf-lib report cards/audit certificates, xlsx export/import | Already proven in the Workers build (Phase 12) | None |
| Queues + Cron | [cloudflare-queue.ts](file:///Users/mac/Documents/School_Management_System/app/server/plugins/cloudflare-queue.ts), [publish-scheduled-announcements.ts](file:///Users/mac/Documents/School_Management_System/app/server/tasks/publish-scheduled-announcements.ts) | Pattern is infra-portable; idempotency designed in | Swap DB handle from Hyperdrive to `env.DB` |
| Shared zod schemas + types | [shared/schemas/](file:///Users/mac/Documents/School_Management_System/app/shared/schemas), [shared/types/](file:///Users/mac/Documents/School_Management_System/app/shared/types) | Validation is authoritative and DB-agnostic | Money/score field types adapted |
| Integer money arithmetic | [shared/utils/money.ts](file:///Users/mac/Documents/School_Management_System/app/shared/utils/money.ts) already does exact integer-cents math | Target wants INTEGER minor units; the arithmetic already exists | Store ints directly instead of NUMERIC strings; rename to kobo idiom |
| Audit logging utility | [audit.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/audit.ts) + audit_logs usage everywhere | Directive requires traceability | None |
| Tests + Vitest setup | 31 files / ~630 cases, [vitest.config.ts](file:///Users/mac/Documents/School_Management_System/app/vitest.config.ts) | Protects the migration | Expectations adapted; add D1 integration tests |
| Deploy model + docs discipline | manual Wrangler, named envs, single master README | Matches directive §19–§21 | README/PROJECT_RULES updated for D1 |

## 4. ADAPT

| Area | Existing implementation | Issue | Migration |
|---|---|---|---|
| 52-table Drizzle schema | 12 files in [database/schema/](file:///Users/mac/Documents/School_Management_System/app/database/schema), `pgTable`/`pgEnum` throughout (201 pg-specific type call sites) | PostgreSQL dialect: `uuid().defaultRandom()`, 16 `pgEnum`s, `numeric()`, `timestamp(withTimezone)`, `date`, `time`, `bigint` | Rewrite to `sqliteTable` from `drizzle-orm/sqlite-core`: `text` PKs app-generated, `text + CHECK` enums, `integer` money/sizes/timestamps (or ISO text per D2), explicit FKs + indexes. Keep all 52 tables and their semantics |
| Initial migration + history | 4 Drizzle PG migrations (892-line 0000 + 3) | PostgreSQL DDL (`CREATE TYPE … ENUM`, `uuid DEFAULT gen_random_uuid()`, `timestamptz`, `public.` schema) | Generate one fresh baseline SQLite/D1 migration; old SQL retained only as the data/spec reference; apply via `wrangler d1 migrations apply` (tool decision D5) |
| DB driver | [db.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/db.ts): per-request `postgres()` via HYPERDRIVE + Node pool | PG protocol; Hyperdrive must be removed | Use Drizzle's D1 driver over the `DB` binding (`env.DB`); delete request-socket lifecycle; adapt Node-local dev (see local-dev row) |
| Runtime config bridge | [cloudflare.ts](file:///Users/mac/Documents/School_Management_System/app/server/plugins/cloudflare.ts) bridges SESSION_SECRET + DATABASE_URL and closes PG clients | DATABASE_URL/cleanup become obsolete | Keep secret bridge; remove DB URL + per-request PG close |
| Queue/cron DB handles | [cloudflare-queue.ts](file:///Users/mac/Documents/School_Management_System/app/server/plugins/cloudflare-queue.ts), cron task call `createWorkerDatabase(HYPERDRIVE.connectionString)` | Hyperdrive-specific | Resolve `env.DB` directly |
| Pagination helper | [pagination.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/pagination.ts) typed `PgTable` / `PostgresJsDatabase`, `count(*)::int` | PG types/cast | Retype to SQLiteTable; `count(*)` plain |
| Case-insensitive search | **40 `ilike` sites** across 6 services (people 14, admissions 6, communication 7, events 5, academic-structure 5, reports 3) | PG-only | `lower(col) like lower(?)` with escaped pattern (SQLite `LIKE` is ASCII-only) |
| Raw SQL fragments | ~20 PostgreSQL-specific fragments in services | `ANY(ARRAY[…]::uuid[])`, `::timestamptz/::date/::time/::uuid` casts, `interval '1 day'`, `current_date`, `array_position(ARRAY[…])`, `||` concat (finance notes) | Rewrite to SQLite/D1 equivalents: parameter lists with `in (…)` / join tables, unix/ISO comparisons, `date(...)`/`datetime(...)` or app-computed boundaries, `||` works in SQLite but verify casts; `.where(sql\`announcement_id IS NOT NULL\`)` partial index is valid in D1 |
| Transactions | **17 interactive `client.transaction(async tx => …)` blocks** in 5 services (finance 7, admissions 4, academic-structure 4, exams 2, communication 1) | D1 has no interactive multi-roundtrip transactions; Drizzle D1 `.transaction()` maps to atomic `batch()` with no read-decide-write inside | Split: pre-read in app code, then single atomic `batch([...])` writes; re-check invariants; keep unique-index last-write guards (invoice issue/void, payment posting/verification/refund, single-current session/term, admissions conversion are the critical ones) |
| Money columns & code | `numeric(12,2)` string transport on fee items, invoices (subtotal/discount/tax/total/paid/balance), invoice items, payments; UI/zod use strings | Target §7 mandates INTEGER minor units (₦150,000 → 15,000,000 kobo) | Columns → `integer`; zod → int (kobo); services stop `toCents()`-ing strings (keep arithmetic helpers as int-native); format at presentation; ~mechanical but wide |
| Score/grading NUMERIC | `numeric(7,2)` on weights, max scores, CA/exam scores, boundaries, totals in [exams.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/exams.ts) | SQLite has no decimal type | Integer hundredths (or thousandths) consistently — decision D2; grading comparisons rewritten |
| IDs | UUID v4 `gen_random_uuid()` PKs on all tables | D1 target = TEXT IDs | `text().primaryKey().$defaultFn(() => crypto.randomUUID())` (crypto.randomUUID is available in Workers and Node 19+) |
| Timestamps/dates/times | `timestamptz defaultNow()`, `date`, `time` columns everywhere | D1 has no temporal types | One representation decision D2 (recommended: TEXT ISO-8601 UTC, app-set; dates `YYYY-MM-DD`; clock times `HH:MM:SS`) |
| Seeding | [seed.ts](file:///Users/mac/Documents/School_Management_System/app/database/seed.ts) tsx+postgres runner; idempotent catalog seeder (roles/permissions/demo data) | PG connection | Seeder runs against local D1 (Miniflare/`wrangler d1 execute` or a D1-bound script); catalog data is pure TS and reusable |
| wrangler config + env | Hyperdrive blocks/ids, Neon `STAGING_DATABASE_URL`, Postgres.app docs in [.env.example](file:///Users/mac/Documents/School_Management_System/app/.env.example) | Directive forbids Hyperdrive/Neon | Replace with `[[d1_databases]]` per env (local `database_id` placeholder for `wrangler dev`); rewrite env example; remove Postgres local-setup steps |
| Health endpoint | [health.get.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/health.get.ts) exercises the PG client | Engine check | `select 1` on `env.DB` |
| Client money/UX surfaces | fees, invoices, billing pages and client services | String NGN inputs | Integer-kobo inputs/formatting; brand palette/typography aligned to UI brief §3 |
| Master README + rules/docs | README §§29–31, 39, 46–51, PROJECT_RULES, .trae rule, docs/DATABASE|CLOUDFLARE|TESTING all describe PostgreSQL/Hyperdrive | Reality will change; directive §18 forbids duplicate docs | Update in place; append change-log entry marking the v2.0 D1 decision |

## 5. REWRITE

| Area | Reason | Replacement |
|---|---|---|
| Database schema definition layer | Engine change is pervasive (pg-core imports, enum types, defaults) | sqlite-core version of the same 52-table model + added tables (§7 notes) |
| Payment integration | No gateway exists; v2.0 requires `Client → Worker → Paystack → webhook → verification → D1 → ledger → receipt` | Paystack initialize endpoint, signed-webhook route (`x-paystack-signature` HMAC), server-side transaction verify, idempotent posting (existing `idempotency_key`/`provider_reference` columns), invoice+receipt reuse; never trust browser callback; no hard-coded bank details |
| Public website | Only portal pages exist; PRD needs Home/About/Academics/Admissions/Fees/News/Events/Gallery/Contact/FAQ + public result checker, with the VCS brand brief | New public page group + content tables (`news_posts`, `faqs`, `contact_messages`, `newsletter_subscribers`; events/gallery already exist) + public APIs, after D1 foundation is stable (plan Phase 5) |
| Fee ledger vocabulary | Current model = fee structures/items → invoices → payments; target schema names `fee_structures` + `fee_ledger` + `payments` | Map invoice-items postings into a ledger view/table during D1 rewrite so both concepts reconcile (one ledger, AppFlow §16) |
| Local development database path | `nuxt dev` + local PostgreSQL assumed | `wrangler dev`/Miniflare local D1 as primary dev DB (zero remote infra preserved); document the one supported path |

## 6. REMOVE

| Item | Reason | Safe removal condition |
|---|---|---|
| `postgres` npm dependency and all `drizzle-orm/postgres-js` imports | Forbidden DB engine | After D1 driver handles every call site and tests pass |
| `[[hyperdrive]]` blocks + staging id in wrangler.toml; `createWorkerDatabase`/Hyperdrive types | Forbidden binding | D1 bindings work local + staging |
| `DATABASE_URL` / `STAGING_DATABASE_URL` (Neon) in env examples, README setup, seed runner | No external DB | D1 local/remote commands documented; owner confirms Neon decommission timing |
| Local Postgres.app tooling instructions | Directive §4 disallows local PostgreSQL | Local D1 workflow verified end-to-end |
| [frontend/](file:///Users/mac/Documents/School_Management_System/frontend) Vue+Vite scaffold (health demo, axios) | README §47 kept it only “until the Nuxt app reaches feature parity” — parity long passed (29 pages, full API) | Owner confirms; recoverable from git history |
| [app/wrangler.pages.toml](file:///Users/mac/Documents/School_Management_System/app/wrangler.pages.toml) | Superseded Pages preset kept “for rollback” | Owner confirms Worker preset is permanent |
| Root `default.profraw` | Stray coverage binary artifact | Trivial — not referenced anywhere |
| Root `"README 2.md"` | Duplicate package README created during copy-in | Confirm it is the duplicate package file |
| PG-specific historical docs after rewrite | `ARCHITECTURE_DECISION_RECORD.md` / `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md` / `MIGRATION_PLAN.md` are “PROPOSED” PG-era history; directive §18 bars competing docs | Owner decision: archive into one “decisions” appendix of master README **or** delete; never leave as live guidance |
| PostgreSQL migrations (`database/migrations/*.sql` + drizzle meta) | DDL cannot run on D1 | After fresh D1 baseline is generated and applied; keep in git pre-D1 tag |

## 7. Database Migration

PostgreSQL surface explicitly inspected (directive §7): **16 enums, UUID PKs on every table, NUMERIC money and scores, timestamptz/date/time, the postgres-js driver, 17 interactive transactions, every FK/cascade behavior, indexes incl. one partial unique index, Drizzle migrations + journal, tsx seed scripts, raw SQL, and ~630 tests.**

| Existing | D1 target | Action |
|---|---|---|
| 16 PostgreSQL `pgEnum` types (student_status, enrollment_status, attendance_status, attendance_session_status, result_status, publication_status, submission_status, admission_status, invoice_status, payment_status, payment_method, gender, audience, notification_status, message_direction, weekday) | `TEXT … CHECK (col IN (…))` (Drizzle `text({ enum })`) | Mechanical conversion in schema + seed catalog values unchanged; CHECK validates writes |
| `uuid defaultRandom()` PK/FK (all 52 tables) | `TEXT` primary/foreign keys, app-generated UUIDs | `$defaultFn(() => crypto.randomUUID())`; join-table composite PKs unchanged |
| `NUMERIC(12,2)` money (fees, invoices, payments) | `INTEGER` kobo (minor units) | Schema + zod + service arithmetic + UI; reuse existing integer math in money.ts; NGN max values stay well inside JS safe-integer range |
| `NUMERIC(7,2)` scores/weights/boundaries/totals | Integer fixed-point (recommended ×100) | Needs owner decision D2; affects grading comparisons and report-card rendering |
| `timestamp with time zone default now()` (and `date`, `time`) | One consistent representation (recommended TEXT ISO-8601 UTC app-set; date/clock TEXT) | App-level `new Date().toISOString()` defaults; rewrite `current_date`/interval fragments; index ordering preserved lexicographically |
| `bigint size_bytes` | `INTEGER` (SQLite/D1 int is 64-bit) | Direct mapping |
| `boolean` flags | `integer` 0/1 (Drizzle boolean mode) | Transparent through Drizzle |
| postgres-js driver + HYPERDRIVE binding | D1 `DB` binding via `drizzle-orm/d1` | Rewrite db.ts + plugin + queue/cron handles |
| Interactive transactions (17 sites) | Atomic `batch()` / constrained transactions | Restructure read-decide-write flows; retain unique constraints as guards |
| `ILIKE` search (40 sites) | `lower(x) LIKE lower(?)` | Escape `%/_`; helper to centralize |
| PG-only raw SQL (~20 fragments: `ANY(::uuid[])`, casts, interval, array_position, `||`) | SQLite-compatible SQL | Per-site rewrite; `excluded.*` upsert refs and partial indexes already work in D1 |
| `text` JSON-in-string (`audit_logs.metadata`) | Keep TEXT JSON | No change; continue `JSON.parse/stringify` |
| Drizzle PG migrations + journal | D1 migration set | Fresh D1 baseline; apply with chosen tooling (D5); old set preserved only in pre-D1 tag |
| tsx + postgres seeder | Local-D1 seeder | Reuse pure seed catalog; run via local D1 binding; fake-data-only rule preserved |
| Schema feature gaps vs `05_BACKEND_SCHEMA.md` | Missing tables | ADD: `news_posts`, `faqs`, `contact_messages`, `newsletter_subscribers`, `library_books`, `library_loans`; reconcile/rename: unified `documents` vs current per-domain object-key tables (D6), `guardians/student_guardians` vs `parents/student_parents`, simplified `applications` vs current richer admissions tables, `fee_ledger` vs invoices. **Keep richer existing structures** (sections, staff_profiles, timetable, grading scales, report cards, notifications, attendance sessions) — do not delete capability to match the shorter target doc |
| Data migration | — | **No production data exists.** Staging holds demo rows only → no ETL; reseed fake data after D1 cutover (lowest possible data risk) |

## 8. Authentication Gap

Already implemented and portable: PBKDF2-SHA512 hashing with parameterized upgrade format; HMAC-signed HttpOnly/Secure/SameSite cookies; idle + “remember” expiry; logout and password-change **session revocation via KV markers**; password reset tokens (single-use, fingerprint-bound, sliding-window throttled); login rate limit 10/5min per IP+email and reset 5/15min per IP with numeric `Retry-After`; account active/deleted status checks; generic login error (no enumeration); audit entries; double-submit CSRF on all mutating `/api/*` requests; server-side `requireUser/requireRole/requirePermission`; parent↔linked-child and teacher↔assigned class/subject row scoping.

Gaps/decisions:
- **D4 — sessions table:** target doc `05` models a `sessions` table; the current design is intentionally stateless (signed cookie) **plus** KV revocation, which already satisfies directive §9. Recommendation: keep stateless sessions; adding a D1 sessions table is optional hard-state. Owner decision required.
- Account lockout/email verification columns exist (`email_verified_at`) but no verification flow — unchanged by D1; keep as configurable.
- RBAC shape decision D3 (5 join tables vs flattened `users.role`): recommendation **keep the current richer model** (multi-role, 104 granular slugs); it is a superset of TRD §10’s example permissions and needs zero redesign.

## 9. R2 Gap

R2 already stores: student photos, admission documents, assignment attachments, submissions, learning resources, gallery images + WASM-generated thumbnails, generated report-card PDFs, payment receipts, audit certificates. Access is exclusively through the `R2_BUCKET` binding; all downloads are streamed through authorized Nitro handlers with private cache headers and role/scope checks; uploads validate declared type via magic bytes; public r2.dev is disabled. **No R2 architectural work is required by the D1 migration** — only the metadata tables move engines. Gap vs target: consider the unified `documents` table (D6) rather than four metadata tables; this is an optional consolidation, not a security issue.

## 10. KV Gap

Current usage already complies with directive §12: rate-limit counters (`rl:` TTL keys) and session-revocation markers (`sess:` TTL keys); callers fail-open/closed deliberately in Node dev where unbound. Nothing authoritative lives in KV. After cutover KV can additionally cache public website content and school settings (short TTL) per TRD §12 — additive only.

## 11. Cloudflare Gap

- Worker/Static Assets/R2/KV/Queues/Cron: present and deployed (staging live) — KEEP.
- **Replace Hyperdrive with D1 bindings** in `wrangler.toml` (top-level local placeholder + staging/prod `[[env.*.d1_databases]]`); provision `sms-db-staging` / later `sms-db-production`; local D1 created automatically under `.wrangler`.
- Remove Neon project from the data path; keep the live PG-backed staging Worker running **until** the D1 staging Worker passes acceptance, then decommission Neon (owner confirmation — R1/D1).
- Secrets: `SESSION_SECRET` handling unchanged and must stay stable; add `PAYSTACK_SECRET_KEY` / webhook secret via `wrangler secret put` when Phase 10 (new plan) lands; never commit.
- Local dev becomes `npm run cf:dev` (build + `wrangler dev` with local D1/R2/KV/Queues); plain `nuxt dev` loses the database unless we add a local SQLite adapter (not recommended — adds a native dependency; directive §4 points at Wrangler local D1).
- DNS/domain: untouched until production approval.

## 12. UI/UX Gap

- Exists: login + 28 management/portal pages, BaseModal, pagination composable, Pinia auth, dashboard, tables/forms for all admin/teacher workflows; tablet-aware pages; result status badges; fee/invoice screens.
- Gap vs `03_UI_UX_DESIGN_BRIEF.md`: no branded public site at all; no homepage hero/statistics/CTAs, About/Admissions/Fees/Gallery public views, FAQ, contact, public result checker; design tokens must be checked against the VCS palette (Primary Blue `#1A237E`, Gold `#C9A84C`, Red `#B22234`, Cream `#F8F4E8`) and faith-integration guidance; no `layouts/` directory (shell is inline) — introduce proper public vs portal layouts in the website phase.
- Parent/Student experiences are thin (data is served via `/my/*` APIs but dedicated portal screens per AppFlow §8–9 are minimal): planned new-plan Phases 8–9.
- Teacher flows (attendance 4-step, results draft→submit) already follow AppFlow; preserve.

## 13. Security Gap

Server-side authenticate→identify→authorize→scope-check is already enforced route-side; CSRF, throttling, headers, audit, file sniffing, private R2, secret-bridge (no secrets in Worker bundle) are done. Remaining items: (1) Paystack signature verification + idempotency + amount/status verification before ledger posting; (2) confirm D1 foreign-key enforcement is active in the generated baseline and covered by tests (D1 enables FKs; verify cascade/`on delete` parity — esp. `restrict` on invoices/enrollments and `set null` on people references); (3) public website surface introduces unauthenticated endpoints — contact/result-checker need throttling, input validation and no data leakage (results only after publication, already enforced service-side).

## 14. Testing Gap

Strengths: 31 files/~630 cases cover shared schemas/types, money exactness, passwords/tokens/throttle/rate-limit/revocation/permissions, service workflows, timetable/exam scoping, PDF/xlsx/slug/time/uploads, queue dispatch idempotency. Gaps: no database-backed integration tests (services are tested as units) — for an engine swap this matters; add a **local-D1 integration suite** (migrations + seed + key journeys: login, invoice→payment→verify, result draft→publish visibility, attendance scope, admission convert, queue consumer); adapt mocks typed against `PostgresJsDatabase`; update money assertions to integer kobo; keep `npm run type-check`/`build`/`test` green per phase.

## 15. Risks

| Risk | Severity | Impact | Mitigation |
|---|---|---|---|
| **R1 — Architecture reversal**: PostgreSQL retention is an explicit recorded hard constraint (README §47/§48, project memory); a live Neon staging exists. The v2.0 prompt orders the exact opposite | Critical | Proceeding without acknowledgment would silently override an owner decision | This checkpoint. Treat the v2.0 package + owner instruction as the explicit change; get sign-off; keep PG staging alive until D1 staging is accepted; tag pre-D1 `main` |
| Uncommitted work on `main` (school-settings feature, README edits, copied spec files) | High | Destructive DB rewrite on a dirty tree is hard to roll back | First action after approval: commit/branch, tag pre-D1 baseline; decide where the seven canonical specs live (repo root vs `docs/spec/`) |
| Interactive-transaction → D1 batch rewrite (17 blocks; money + single-current + admissions conversion) | High | Mis-ordered batching can break atomicity of invoice issue/void/payment posting and session singleton | Pre-read → validate → single atomic batch; unique-index guards kept; D1 integration tests for every money path; finance migrated as its own reviewed phase |
| Integer-kobo sweep across schema/zod/services/UI | High | Mixed units would corrupt fee data | One mechanical change with type-level enforcement (zod int + branded Kobo type); reuse money.ts integer math; format only at edges; full test sweep |
| D1 feature limits vs assumptions | Medium | 10 GB database cap, eventual cross-region reads, no long-running queries, per-statement limits | Trivial for 150–200 students; add indexes from §17 of schema doc; paginate (helper exists); benchmark report queries |
| SQLite semantic differences (FK enforcement, `LIKE` case behavior, type affinity, no `NOW()`) | Medium | Orphaned rows / search misses / silent type coercion | FK pragma verified in migration; central search helper; timestamps as TEXT ISO; integration tests |
| Local-dev workflow change (Postgres.app → Miniflare D1; plain `nuxt dev` loses DB) | Medium | Developer friction | Make `npm run cf:dev` the documented primary path; keep install zero-cloud; update README setup |
| Drizzle D1 migration tooling choice | Medium | Dual migration history if both drizzle-kit and wrangler track applied state | Decision D5 before Phase 2; one tool generates, one applies |
| Scope creep — flattening RBAC / rebuilding working flows “to match the short target doc” | Medium | Loss of tested capability | Keep richer model; additions only (news/FAQ/contact/library); deviations listed, not silently imposed |
| Paystack build before bank details confirmed | Low/Medium | Hard-coded unverified account info | Directive honored: configurable, no hard-coded bank details; webhook-driven only |
| Secrets during transition | Low | Leaked Neon credential (recently rotated) | `.env` stays gitignored; remove Neon URL from examples at cutover; rotate again when Neon is decommissioned |

## 16. Migration Order (repository-specific, mapped to v2.0 plan)

0. **Safety checkpoint (pre-destructive):** review this report; decisions D1–D6 approved; commit pending work; create branch/tag `pre-d1`; place the seven canonical specs under version control in one location.
1. **Phase 1 — Architecture reset (config only, no behavior deletion):** add D1 bindings/config alongside existing; create local D1; swap deps (`postgres` out only after code moves); new db.ts on `env.DB`; plugin/queue/cron/health adapted; `nuxt dev` DB path replaced with `wrangler dev`; env examples + README rules updated.
2. **Phase 2 — D1 foundation:** sqlite-core schema for identity + people + academics (TEXT UUIDs, CHECK enums, integer kobo, ISO timestamps); fresh baseline migration applied to **local D1**; seeder ported; integration harness green.
3. **Phase 3 — Academic core + transaction rewrites:** attendance, assessments/scores, exam scores, publications, report cards; convert 17 transaction blocks as encountered; D1 integration tests for scope/workflow.
4. **Phase 4 — Auth/RBAC re-verify on D1:** full auth journey, throttling, revocation, RBAC boundaries, audit on local D1 (mostly KEEP; prove it).
5. **Phase 4b — Finance on integer kobo:** fee structures, invoices, payments, refunds, receipts, summary/outstanding; atomic batching; money test sweep.
6. **Phases 5–13 (new plan):** public website + content tables; admin gaps; teacher; student; parent; **Paystack**; R2 consolidation check; KV caching; reporting/polish; library and other missing tables slotted in where their phase lands.
7. **Phase 14 — Staging cutover:** provision staging D1/R2/KV/Queue, apply migrations, fake seed, deploy Worker, run acceptance (auth, RBAC boundaries, payment flow with Paystack test keys, result visibility, R2 authz, headers, rate limits); **only then** decommission Neon/Hyperdrive and remove dead code/docs.
8. **Production:** owner-gated, separate resources, domain/DNS, smoke tests per role.

## 17. Approval Checkpoint

- [x] Repository inspected (structure, configs, all 12 schema files, migrations, driver, 15 service modules, auth/R2/KV/queue/cron, tests, env, docs, git state).
- [x] Architecture identified: already Nuxt 4 + Workers + R2 + KV + Queues; delta is PostgreSQL→D1 + Paystack + public website.
- [x] Reusable work identified: §3 (large majority — runtime, auth, security, storage, workflows, tests).
- [x] Obsolete work identified: §6 (Hyperdrive/Neon/postgres driver, old scaffold, stale docs/artifacts).
- [x] D1 changes identified: §7 (enums, UUIDs, NUMERIC×2, timestamps, driver, 17 transactions, 40 ilike, ~20 raw fragments, migrations, seeds).
- [x] Risks identified: §15, led by the explicit PostgreSQL→D1 policy reversal and the uncommitted tree.
- [x] No production-relevant functionality deleted — nothing has been changed yet.

### Decisions requested before Phase 1 starts

- **D1 — Policy reversal & Neon:** confirm D1 is now authoritative and PostgreSQL/Neon/Hyperdrive are decommissioned *after* D1 staging acceptance (recommended), with the PG staging Worker left running until then.
- **D2 — Numeric/temporal representation:** money `INTEGER` kobo (fixed by directive) — confirm scores/weights/boundaries also become integer fixed-point (recommended ×100), and timestamps TEXT ISO-8601 UTC / dates `YYYY-MM-DD` / times `HH:MM:SS`.
- **D3 — RBAC shape:** keep the existing 5 join-table model + 104 permission slugs as a superset of TRD §10 (recommended) instead of flattening to `users.role TEXT`.
- **D4 — Sessions:** keep stateless signed-cookie sessions + KV revocation (recommended; already meets §9) rather than adding a D1 `sessions` table.
- **D5 — Migration tooling:** Drizzle generates SQLite DDL; `wrangler d1 migrations` is the single applier/tracker (recommended) — confirm before Phase 2.
- **D6 — Documents model & naming:** keep per-domain metadata tables now, optionally add the unified `documents` table in the R2 phase; keep richer admissions/finance tables instead of shortening them to the target doc’s minimal shapes.
