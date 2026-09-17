# Phase 12 Part C — Option A: PDF Report Cards

## Context

Phase 12 Part C covers five sub-items (PDF report cards, PDF audit
certificates, Excel exports, admissions report, gallery thumbnails).
Per the user's stated preference (Option A first, B as follow-up,
explicit permission for C), this plan scopes **Option A only: PDF
report cards**. Options B (xlsx exports) and C (gallery thumbnails)
are deferred and will be tackled as separate follow-ups.

The `report_cards` table already has an `object_key` column for the
generated PDF in R2, and `generateReportCard` in
[app/server/services/exams.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/exams.ts) already computes the full
data (subject results, totals, grade, remarks) via
`aggregateStudentResults`. What's missing: actually rendering a PDF,
storing it in R2, and an authorized download endpoint. There is
already a `publishReportCard` route at `/api/v1/report-cards/:id/publish`
and a list/generate pair under `/api/v1/students/:id/report-cards`.

No new migration is required — the `object_key` column exists. No new
permissions are required — `report_cards.view` already gates read
access and is enforced by `getReportCard(id, actor)`.

## Approach

Use **`pdf-lib`** (pure JavaScript, no Node-only deps, Workers-
compatible) to render the PDF as a pure function, and do R2 I/O at the
route layer (mirrors the existing pattern in admissions/resources/
gallery routes where `putObject` / `streamObject` from
[app/server/utils/storage.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/storage.ts) live).

### Step 1 — Add dependency

Add `pdf-lib` to `app/package.json` `dependencies` and run
`npm install` from `app/`.

### Step 2 — Pure PDF render function (new file)

Create `app/server/utils/pdf/report-card.ts` exporting:

```ts
export async function renderReportCardPdf(
  card: ReportCardDetail,
): Promise<Uint8Array>
```

- Pure: no I/O, no `event`, no R2. Takes the existing
  `ReportCardDetail` shape (from
  [app/shared/types/index.ts](file:///Users/mac/Documents/School_Management_System/app/shared/types/index.ts#L779-L787)).
- Layout (single/multi-page, A4 portrait, Helvetica standard fonts):
  - Header: "Report Card" + session name + term name.
  - Student block: name, admission number, class, section.
  - Subject results table: subject name | total | max | % | grade.
  - Assessment/exam score detail rows grouped per subject (compact).
  - Totals row: total score, average %, overall grade.
  - Attendance summary, teacher remark, principal remark (when set).
  - Footer: generated/published date + status.
- Standard fonts only (Helvetica). Unicode font embedding is
  explicitly out of scope (future work); current seed data is ASCII.

### Step 3 — Service helper to persist object key

Add to `app/server/services/exams.ts`:

```ts
export async function setReportCardObjectKey(
  id: string,
  objectKey: string,
): Promise<void>
```

A one-line `update reportCards set object_key = $1 where id = $1`.
Keeps the DB write in the service layer (not the route).

### Step 4 — Wire PDF generation into the generate route

Edit [app/server/api/v1/students/[id]/report-cards.post.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/students/%5Bid%5D/report-cards.post.ts):

After `generateReportCard(...)` returns the card detail:
1. Build a stable object key via `buildObjectKey('report-cards', [card.sessionId, card.termId, card.studentId], 'report-card.pdf', card.id)` (from `server/utils/storage.ts`).
2. `await renderReportCardPdf(card)` → bytes.
3. `await putObject(event, key, bytes.buffer, 'application/pdf')` inside try/catch — on 503 (plain Node dev, no R2 binding) swallow and leave `objectKey` null; on success `await setReportCardObjectKey(card.id, key)`.

Return the (re-fetched) card so the response reflects `objectKey`.

### Step 5 — Wire PDF regeneration into the publish route

Edit [app/server/api/v1/report-cards/[id]/publish.post.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/report-cards/%5Bid%5D/publish.post.ts):

After `publishReportCard(id, actor)` returns the published card:
1. Reuse the same key-building logic (extract to a tiny helper in `report-card.ts` or inline).
2. `renderReportCardPdf(card)` → bytes.
3. `putObject(...)` with try/catch (same 503-swallow on Node dev).
4. `setReportCardObjectKey(card.id, key)` on success.

### Step 6 — Download endpoint (new file)

Create `app/server/api/v1/report-cards/[id]/pdf.get.ts`:

- `requirePermission(event, 'report_cards.view')`
- `parseInput(idParamSchema, { id: getRouterParam(event, 'id') })`
- `actor = await getActor(auth, 'report_cards.view')`
- `card = await getReportCard(id, actor)` — handles 404 and the
  students/parents own-or-children + published-only authorization.
- If `card.objectKey` is null → 404 "Report card PDF not generated."
  (happens under plain Node dev where R2 is unavailable).
- Otherwise `return await streamObject(event, card.objectKey, \`report-card-${card.admissionNumber}.pdf\`, 'application/pdf')`.

### Step 7 — Tests (new file)

Create `app/server/utils/pdf/report-card.test.ts` — pure unit tests,
no R2, no DB:

- Renders a valid PDF: output starts with `%PDF-` magic bytes.
- `PDFDocument.load(bytes)` succeeds and has exactly 1 page for a small
  card.
- Page text contains: student name, admission number, session name,
  term name, each subject name + score + grade.
- Handles empty `subjectResults` (no subject rows; still valid PDF).
- Handles null remarks / null section name / null overall grade.
- Multiple subjects render without overflowing the page boundary
  (page count stays 1 for ≤ ~12 subjects; ≥ ~14 may paginate — assert
  `getPages().length >= 1`).

Use the existing vitest patterns from
[app/server/utils/uploads.test.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/uploads.test.ts).
No integration test for R2 I/O (matches the project convention of not
testing Worker bindings in unit suite).

### Step 8 — Documentation

- `docs/API.md` — add a "Phase 12 — Hardening (Part C / Option A)"
  section listing the new `GET /api/v1/report-cards/:id/pdf` endpoint
  (permission `report_cards.view`, response `application/pdf`
  attachment, 404 when not generated, 503 when R2 unavailable in dev).
- `README.md` Phase 12 section — mark "Part C — Option A: PDF report
  cards ✅ COMPLETE"; keep Option B (xlsx exports) and Option C
  (gallery thumbnails) listed as deferred. Update the "current phase"
  line and the Phase 7 deferred bullet about PDF report cards.

## Critical files to modify

- `app/package.json` — add `pdf-lib`.
- `app/server/utils/pdf/report-card.ts` — **new** pure render fn.
- `app/server/utils/pdf/report-card.test.ts` — **new** tests.
- `app/server/services/exams.ts` — add `setReportCardObjectKey`.
- `app/server/api/v1/students/[id]/report-cards.post.ts` — wire gen.
- `app/server/api/v1/report-cards/[id]/publish.post.ts` — wire regen.
- `app/server/api/v1/report-cards/[id]/pdf.get.ts` — **new** download.
- `docs/API.md` — Phase 12 Part C / Option A section.
- `README.md` — Phase 12 Part C Option A status.

## Reused utilities (do not reimplement)

- `buildObjectKey`, `putObject`, `streamObject` from
  [app/server/utils/storage.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/storage.ts).
- `getReportCard`, `publishReportCard`, `getActor`, `generateReportCard`
  from
  [app/server/services/exams.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/exams.ts).
- `requirePermission`, `parseInput`, `idParamSchema`,
  `reportCardGenerateSchema` from existing utils/schemas.
- `writeAudit` for the audit log (already called in both routes).

## Verification

Run from `app/`:

1. `npm install` (pick up `pdf-lib`).
2. `npm run test` — existing 334 tests + new render tests, all green.
3. `npm run type-check` — clean.
4. `npm run build` — cloudflare-module build succeeds (confirms the
   new code is Workers-compatible).
5. Smoke: `npm run cf:dev`, then `POST /api/v1/students/:id/report-cards`
   with seeded data → response includes non-null `objectKey`; then
   `GET /api/v1/report-cards/:id/pdf` returns `application/pdf` with
   `%PDF-` body. (Plain `npm run dev` returns null `objectKey` and the
   PDF endpoint returns 404 — expected, documented.)
6. `npm run db:seed` idempotent (no schema change; sanity check only).

## Known limitations (to document)

- PDF uses standard Latin fonts only; non-Latin student names may not
  render correctly (font embedding deferred).
- PDF storage requires the `R2_BUCKET` binding; plain `npm run dev`
  cannot store or serve PDFs (returns 404 on download, null
  `objectKey` on generate). Use `npm run cf:dev` or staging/prod.
- PDF is regenerated on publish only — editing a published card's
  remarks without re-publishing will leave a stale PDF (matches the
  publish-gated access model).
- Options B (xlsx exports) and C (gallery thumbnails) remain deferred.
