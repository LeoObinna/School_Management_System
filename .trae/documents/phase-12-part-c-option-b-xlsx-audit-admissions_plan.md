# Phase 12 Part C — Option B: xlsx exports, admissions pipeline report, PDF audit certificate

## Repository Research

Five routes already implement `?format=csv` with a duplicated `csvCell`
helper and ad-hoc `String(getQuery(event).format ?? 'json')` parsing
(no validation of the format value):

| Route | Base permission | Export permission |
|---|---|---|
| `GET /api/v1/students` | `students.view` | `students.export` |
| `GET /api/v1/reports/attendance` | `reports.view` | `reports.export` |
| `GET /api/v1/reports/enrollments` | `reports.view` | `reports.export` |
| `GET /api/v1/audit-logs` | `audit_logs.view` | `reports.export` |
| `GET /api/v1/finance/outstanding` | `invoices.view` | `finance.export` |

Services behind them (`reports.ts`, `people.listStudentsForExport`,
`finance.listOutstanding`) already return flat row arrays.

Gaps the README lists as Phase 12 deferred: **Excel/.xlsx exports**,
**admissions-pipeline report** (§27 admin dashboard), and **PDF audit
certificates** (§26 audit logs). `admissions.view` exists; there is no
`admissions.export`/`exams.export` slug — precedent (`audit-logs` CSV)
is that cross-domain exports gate on `reports.export`. No new
permissions and no migrations are needed.

Runtime constraint: Cloudflare Workers (`nodejs_compat` enabled,
compatibility_date 2025-07-15). Chosen library: **`write-excel-file`
v4** (`/universal` entry) — zero Node APIs, returns a standard `Blob`
via `writeXlsxFile(rows).toBlob()` in both browser/Node/edge, one
dependency (`fflate`). Sheet data is `Array<Array<string|number|
boolean|Date|null>>`; header styling uses `{ value, fontWeight:'bold' }`
cell objects.

## Files and Modules

- `app/package.json` — add `write-excel-file` (dependency) and
  `read-excel-file` (devDependency, round-trip assertions only).
- `app/shared/schemas/reports.ts` — add `exportFormatSchema`
  (`z.enum(['json','csv','xlsx'])`), re-exported via barrel.
- `app/server/utils/exports.ts` — **new**: `parseFormat(event)`
  (validated, 422 on unknown), `csvCell`, `toCsv(headers, rows)`,
  `renderXlsx(headers, rows): Promise<Uint8Array>` (universal write,
  bold header row), `sendWorkbook(event, filename, headers, rows)`
  (sets xlsx content-type + disposition, returns bytes).
- Existing 5 CSV routes — replace duplicated helpers with the shared
  util; add the `xlsx` branch reusing the same header/row arrays.
- `app/server/services/exams.ts` — new `getExamScoresForExport(id)`:
  loads exam (404), returns long-format rows
  `[admissionNumber, studentName, subjectCode, subjectName, maxScore,
  score, grade]` from `exam_scores` ⋈ `exam_subjects` ⋈ `subjects` ⋈
  `students`, ordered by admission number then subject name.
- `app/server/api/v1/exams/[id].get.ts` — add `?format=xlsx`
  (`exams.view` + `reports.export`); JSON behavior unchanged.
- `app/server/services/reports.ts` — new
  `getAdmissionsPipeline(query)`: GROUP BY status counts over
  `admission_applications` with optional `sessionId`/`intendedClassId`
  filters; pure helper `orderPipelineRows(counts)` maps results onto
  the full ordered stage list (zero-count stages included). Also new
  `getAuditCertificateSummary(query)`: total + per-action counts
  (GROUP BY action, desc) for the same filter set as `listAuditLogs`.
- `app/shared/schemas/reports.ts` — `admissionsPipelineQuerySchema`
  (sessionId/intendedClassId optional); `app/shared/types` —
  `AdmissionsPipelineRow` + `AuditCertificateSummary` types.
- `app/server/api/v1/reports/admissions.get.ts` — **new**: JSON
  default (`admissions.view`), csv/xlsx via `reports.export`.
- `app/server/utils/pdf/audit-certificate.ts` — **new** pure
  `renderAuditCertificatePdf(model)` using pdf-lib (reuse helpers
  pattern from `report-card.ts`): title "Audit Certificate",
  generated-at, generated-by actor (name/email), filter criteria
  (period/action/resource/user), total records, action breakdown
  table, append-only statement; signed-off footer.
- `app/server/api/v1/reports/audit-certificate.get.ts` — **new**
  `GET /api/v1/reports/audit-certificate` (PDF): `audit_logs.view` +
  `reports.export`, parses the audit-log filter query, loads summary +
  auth user identity, returns `application/pdf` bytes (generated
  on the fly — not stored in R2; point-in-time extract).
- Tests — **new**:
  `server/utils/__tests__/exports.test.ts` (format parsing, csv
  escaping, xlsx round-trip via read-excel-file: headers/values/types
  + ZIP magic), `server/services/__tests__/admissions-pipeline.test.ts`
  (ordering, zero-fill, total),
  `server/utils/pdf/__tests__/audit-certificate.test.ts` (magic
  header, actor/filters/totals/breakdown text via the existing
  inflate+hex decode technique).
- `docs/API.md` — "Phase 12 — Hardening (Part C / Option B)" section.
- `README.md` — mark Option B complete; trim deferred lists; update
  current-phase footer and the Phase 11 deferred sentence.

## Implementation Steps

1. Install deps; add `exportFormatSchema` + new shared types.
2. Build `server/utils/exports.ts` (parse/csv/xlsx/send).
3. Refactor the 5 existing routes onto the shared util and add xlsx.
4. Add `getExamScoresForExport` + wire `exams/[id].get.ts` xlsx.
5. Add admissions pipeline service + pure ordering helper + route
   (json/csv/xlsx).
6. Add audit certificate summary service, PDF renderer, route.
7. Write tests; run full gates; update docs.

## Dependencies and Considerations

- `write-excel-file/universal` must be imported from the explicit
  subpath (the default `/browser` entry v4 uses Web Workers, which do
  not exist in the Workers runtime). Verify with `npm run build` +
  `wrangler deploy --dry-run` that no Node built-ins are bundled.
- xlsx rows use JS numbers for counts/scores; money/rate NUMERIC
  strings stay strings (no float coercion) — consistent with the API
  contract and the "NUMERIC for money" rule.
- Grade export includes only recorded exam scores (long format);
  students with no score row are not listed (documented; avoids
  inventing enrollment-join semantics).
- Audit certificate is generated on demand from live aggregates — no
  R2 storage, no persistence (unlike report cards). It attests what
  the audit log contains for a filter window; wording claims
  append-only application behaviour, not cryptographic sealing.
- Invalid `?format=` values currently fall through to JSON; they will
  now 422 via zod (intentional hardening).

## Validation

From `app/`:
1. `npm run test` — 349 existing + new tests all green.
2. `npm run type-check` — clean.
3. `npm run build` — succeeds; grep `.output/server` for the
   universal xlsx chunk; `npx wrangler deploy --dry-run` clean.
4. `npm run db:seed` idempotent (no schema change; sanity only).
5. Smoke under `npm run cf:dev` with seeded data: fetch each of the 7
  xlsx endpoints and the audit-certificate PDF, verify
  `content-type`, `%PDF-` / `PK\x03\x04` magic bytes, and open one
  workbook via the read-excel-file round-trip in tests.

## Risks

- Universal bundle pulls a Node API anyway → fallback to
  `write-excel-file/node` `toBuffer()` (works under
  `nodejs_compat`); if both fail, generate xlsx with fflate directly
  is not justified — stop and report rather than hand-rolling OOXML.
- Subpath TypeScript types missing for `/universal` → add a local
  ambient declaration in `types/` rather than `@ts-ignore`.
- read-excel-file ESM interop in Vitest → use its `/node` entry; if
  resolution fails, assert on zip entries via fflate instead.
