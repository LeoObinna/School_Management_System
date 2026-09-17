# Phase 11 — Reports/audit

## Context

Phase 10 (Communication/events) shipped. README §41 defines Phase 11 as
"Operational reports, exports and audit UI." README §26 requires audit
logging of sensitive operations; §27 lists admin dashboard KPIs
(counts, attendance rate, outstanding fees, admissions pipeline, audit
activity). The `audit_logs` table and `writeAudit(event, entry)` helper
already exist and are called from ~40+ route handlers, but there is no
way to *view* audit logs. Permission slugs `reports.view`,
`reports.export`, `audit_logs.view`, `students.export` already exist
in [catalog.ts](file:///Users/mac/Documents/School_Management_System/app/database/seeds/catalog.ts)
with correct role grants (super_admin: all; admin: all except
`roles.manage`+`audit_logs.view`; teacher: `reports.view` only;
student/parent: none). **Zero migrations and zero new permission slugs
are required.**

Outcome: staff can browse audit logs (super_admin only), view a
school-wide overview, run attendance/enrollment operational reports
with CSV export, and download the student directory as CSV.

## Enums (verified against schema/enums.ts)

- `enrollmentStatusEnum`: `active | completed | promoted | repeated | withdrawn`
- `attendanceStatusEnum`: `present | absent | late | excused`
- `publicationStatusEnum`: `draft | scheduled | published | archived`

## Scope (5 endpoints + 2 pages + dashboard + seeds + docs)

### A. Audit log viewer (headline)
- `GET /api/v1/audit-logs` — paginated JSON, filters: `action`,
  `resource`, `userId`, `dateFrom`, `dateTo`, `search` (ilike on
  description/action). LEFT JOIN users for `userName`/`userEmail`.
  Gated `audit_logs.view`. `?format=csv` requires `reports.export`.
- `/audit-logs` page: filter bar + table (timestamp, user, action,
  resource, resourceId, description, IP, metadata expandable) + CSV
  download + pagination.

### B. Reports overview
- `GET /api/v1/reports/overview?sessionId=&termId=` — single object:
  `studentsTotal/active/archived`, `teachers/parents/staff` counts,
  `classes/sections/subjects` counts, `enrollmentsByStatus` (all 5
  enum keys, 0 when absent), `announcementsByStatus` (all 4 enum keys),
  `eventsUpcoming`, `eventsPast`. Gated `reports.view`. No CSV.
- `/reports` page: overview cards + sub-report links + CSV buttons.

### C. Operational reports (CSV-capable)
- `GET /api/v1/reports/attendance?sessionId=&termId=&classId=&dateFrom=&dateTo=`
  — one row per class: `className`, `present/absent/late/excused`
  counts, `total`, `rate` (NUMERIC, 2 dp). Gated `reports.view`; CSV →
  `reports.export`.
- `GET /api/v1/reports/enrollments?sessionId=&classId=&status=` — one
  row per `(class, status)`: `className`, `status`, `count`. Gated
  `reports.view`; CSV → `reports.export`.

### D. Student directory CSV (uses dormant `students.export` slug)
- Extend existing `GET /api/v1/students` with `?format=csv` branch.
  JSON branch unchanged (`students.view`); CSV branch requires
  `students.export`. Columns: admission no, first/last name, status,
  class, guardian name, guardian email, guardian phone.

### E. Dashboard
- Two new sections in [pages/index.vue](file:///Users/mac/Documents/School_Management_System/app/pages/index.vue)
  before "System Health": "Reports" (gated `reports.view`), "Audit
  logs" (gated `audit_logs.view`).

## Reused patterns (do NOT duplicate)

- CSV export: [finance/outstanding.get.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/finance/outstanding.get.ts)
  — local `csvCell()` quoting; same route handles JSON default and
  `?format=csv` requiring the export slug.
- Manual pagination with JOIN: `listAnnouncements` in
  [communication.ts service](file:///Users/mac/Documents/School_Management_System/app/server/services/communication.ts)
  — two queries (`count(*)::int` then `select().leftJoin().where().orderBy().limit().offset()`).
  `smsPaginate` only takes a single PgTable and cannot JOIN, so use
  manual for `listAuditLogs`.
- Summary aggregates: `financeSummary` in
  [finance.ts service L1519-1627](file:///Users/mac/Documents/School_Management_System/app/server/services/finance.ts)
  — `sql<number>\`count(*)::int\``, `COUNT(*) FILTER (WHERE ...)`,
  enumerate all enum keys at construction so missing statuses return 0.
- Shared schema primitives: `paginationQuerySchema`, `uuidSchema`,
  `dateStringSchema` in [common.ts](file:///Users/mac/Documents/School_Management_System/app/shared/schemas/common.ts).
- Serialize helpers: `toJsonModel<T>`, `toJsonList<T>` in
  [server/utils/serialize.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/serialize.ts).

## Files

### NEW
- `app/shared/schemas/reports.ts` — `overviewQuerySchema`,
  `attendanceReportQuerySchema`, `enrollmentReportQuerySchema`,
  `auditLogListQuerySchema` (extends `paginationQuerySchema` with
  `action`, `resource`, `userId`, `dateFrom`, `dateTo`). Export
  `AUDIT_LOG_RESOURCES` tuple const (mirror `PAYMENT_METHODS` shape in
  [finance.ts schema L33](file:///Users/mac/Documents/School_Management_System/app/shared/schemas/finance.ts)).
- `app/server/services/reports.ts` — `getOverview`,
  `getAttendanceReport`, `getEnrollmentReport`, `listAuditLogs`.
- `app/server/api/v1/reports/overview.get.ts`
- `app/server/api/v1/reports/attendance.get.ts`
- `app/server/api/v1/reports/enrollments.get.ts`
- `app/server/api/v1/audit-logs/index.get.ts`
- `app/pages/reports/index.vue`
- `app/pages/audit-logs/index.vue`
- `app/shared/__tests__/reports.test.ts` — schema parsing +
  `AUDIT_LOG_RESOURCES` membership (mirror
  [finance.test.ts](file:///Users/mac/Documents/School_Management_System/app/shared/__tests__/finance.test.ts)).

### MODIFIED
- `app/shared/schemas/index.ts` — add `export * from './reports'`.
- `app/shared/types/index.ts` — append `OverviewReport`,
  `AttendanceReportClassRow`, `EnrollmentReportRow`, `AuditLog`,
  `AuditLogListItem` (extends `AuditLog` with `userName`/`userEmail`
  nullable).
- `app/server/api/v1/students/index.get.ts` — add `?format=csv`
  branch.
- `app/server/services/people.ts` — add `listStudentsForExport()`
  returning the joined shape (NOT replacing `listStudents`).
- `app/pages/index.vue` — two new sections before System Health.
- `app/database/seeds/index.ts` — import `auditLogs`, append 10-row
  audit seed block (idempotent on
  `userId+action+resource+createdAt` with fixed ISO timestamps).
- `docs/API.md` — append "## Phase 11 — Reports/audit" after Phase 10.
- `README.md` — §41 Phase 11 → ✅ COMPLETE; §47 status block; §51
  changelog entry dated 2026-09-16.
- `docs/ARCHITECTURE.md` — status header bump to "Phases 0–11".

## Audit log seed (10 rows, fixed timestamps for idempotency)

| userId | action | resource | description | createdAt |
|---|---|---|---|---|
| superadmin | auth.login | auth | Super admin signed in | 2026-09-13T08:00:00Z |
| superadmin | role.update | role | Adjusted teacher role permissions | 2026-09-13T16:00:00Z |
| admin | student.create | student | Created Amara Okafor (STU-001) | 2026-09-14T14:00:00Z |
| admin | student.archive | student | Archived STU-002 | 2026-09-14T15:00:00Z |
| admin | invoice.create | invoice | Issued termly tuition invoice | 2026-09-15T11:00:00Z |
| teacher | attendance.mark | attendance | Marked Primary 1 attendance | 2026-09-15T13:00:00Z |
| admin | payment.verify | payment | Verified bank transfer NGN 50,000 | 2026-09-15T15:30:00Z |
| superadmin | announcement.publish | announcement | Published welcome announcement | 2026-09-16T09:00:00Z |
| admin | admission.advance | admission | Advanced STU-004 to under_review | 2026-09-16T10:00:00Z |
| superadmin | user.update | user | Deactivated former staff account | 2026-09-16T11:00:00Z |

Pattern matches the `seedAnnouncements` pre-check-then-insert block
(idempotent on the natural-key tuple).

## Risks

- **`metadata` JSON string column** — CSV: include as last column via
  `csvCell()` (a quoted JSON string with embedded `"`/newlines
  round-trips fine). UI: expandable row detail that
  `JSON.parse(metadata ?? 'null')` and pretty-prints; fall back to raw
  string on parse failure. Never inline (cells get tall).
- **Deleted users** — `audit_logs.userId` is `ON DELETE SET NULL`;
  LEFT JOIN yields null `userName`/`userEmail`. UI: render
  "System / deleted user"; CSV: empty cells.
- **`enrollmentsByStatus`/`announcementsByStatus` keys** — enumerate
  the full enum at construction (like `invoicesByStatus` in
  [finance.ts service L1562-1572](file:///Users/mac/Documents/School_Management_System/app/server/services/finance.ts))
  so missing statuses return `0` rather than vanishing.
- **Overview performance** — ~8 separate COUNT queries; acceptable on
  school-scale DB. Do NOT union into one mega-query (keep each readable
  and individually cacheable later).

## Execution order

1. `shared/schemas/reports.ts` + barrel + `shared/types/index.ts`
   append + `shared/__tests__/reports.test.ts` (no server deps).
2. `server/services/reports.ts` (depends on schemas + types).
3. `server/services/people.ts` `listStudentsForExport` (existing
   schema/serialize utils only).
4. API routes (`reports/*.get.ts`, `audit-logs/index.get.ts`) +
   extend `students/index.get.ts` CSV branch (depend on services).
5. Pages (`reports/index.vue`, `audit-logs/index.vue`) + dashboard
   section (depend on routes).
6. Seeds (`audit_logs` block).
7. Docs (API.md, README, ARCHITECTURE) — last, after verification
   gates are green.

## Verification

From `app/`:

1. `set -a; source .env; set +a; npm run db:seed` — seeds the 10
   audit rows; psql verify: `SELECT action, resource, COUNT(*) FROM
   audit_logs GROUP BY 1, 2;` returns 10 distinct rows.
2. psql verify counts: `SELECT COUNT(*) FROM audit_logs;` = 10.
3. `npm run test` — expect ~280+ tests (baseline 272 + ~8 new schema
   tests).
4. `npm run type-check` — definitive TypeScript check.
5. `npm run build` — cloudflare-module Worker build; new route chunks
   emitted under `.output/server/chunks/routes/api/v1/reports/` and
   `audit-logs/`.
6. Dev-server smoke test — Phase 11 endpoints return 401
   unauthenticated:
   - `GET /api/v1/audit-logs` → 401
   - `GET /api/v1/reports/overview` → 401
   - `GET /api/v1/reports/attendance` → 401
   - `GET /api/v1/reports/enrollments` → 401
   - `GET /api/v1/students?format=csv` → 401
7. As super_admin: confirm audit-logs list returns 10 rows; overview
   returns non-zero counts; attendance/enrollments reports return
   rows; students CSV downloads. (Manual — out of scope for automated
   verification unless a smoke auth flow exists.)

## Known limitations (carried forward)

- PDF report cards and PDF audit certificates deferred to Phase 12.
- Excel (.xlsx) exports deferred — CSV only for Phase 11.
- Admissions-pipeline report not added (finance summary + outstanding
  already cover finance KPIs; admissions pipeline KPIs surface on the
  admissions page itself).
- Row-level scoping (e.g., teacher sees only their classes' attendance
  report) deferred to Phase 12 hardening — Phase 11 reports are
  school-wide, gated by `reports.view`/`reports.export`.

## Next phase

Phase 12 — Hardening (security, authorization tightening, file magic
byte validation, rate limits via KV/Durable Objects, queue consumer
for async email, gallery thumbnail pipeline, performance,
accessibility, staging review).
