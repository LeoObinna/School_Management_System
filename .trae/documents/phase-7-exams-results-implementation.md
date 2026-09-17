# Phase 7 — Exams / Results Implementation Plan

## Context

Phases 0–6 are complete (commit `f8922bb`). The README §41 phase record and
`docs/ARCHITECTURE.md` show Phase 7 (exams/results) as the current phase.
The user has approved starting it.

**Schema and migrations already exist** (forward-declared in the Phase 0
scaffold): all 9 Phase 7 tables live in
[app/database/schema/exams.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/exams.ts),
are exported from
[app/database/schema/index.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/index.ts#L19),
and the SQL lives in
[migrations/0000_clever_garia.sql](file:///Users/mac/Documents/School_Management_System/app/database/migrations/0000_clever_garia.sql).
`resultStatusEnum` is defined in
[enums.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/enums.ts#L46-L51).
Permission slugs (`exams.view/create/update`,
`exam_results.view/enter/update/submit/approve/publish`,
`report_cards.view/generate/publish`) are already seeded in
[seeds/catalog.ts](file:///Users/mac/Documents/School_Management_System/app/database/seeds/catalog.ts#L68-L79)
with role mappings.

**No Phase 7 functionality exists yet** — no API routes, services, shared
schemas, frontend, tests, or seed data. This plan builds the full feature
layer on top of the existing schema.

## Scope decisions (user-approved)

1. **Report cards PDF**: deferred. Phase 7 builds report-card metadata,
   JSON view, and the generate/preview/publish workflow. The `objectKey`
   column stays null. PDF generation is recorded as a known limitation
   for a later phase.
2. **Score entry**: bulk + single. Single-row upsert endpoints plus one
   bulk class-wide upsert per score kind (assessment and exam).

## Existing patterns to mirror

Phase 6 ([app/server/services/assignments.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/assignments.ts),
[app/server/api/v1/assignments/index.post.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/assignments/index.post.ts),
[app/shared/schemas/assignments.ts](file:///Users/mac/Documents/School_Management_System/app/shared/schemas/assignments.ts),
[app/pages/assignments/index.vue](file:///Users/mac/Documents/School_Management_System/app/pages/assignments/index.vue),
[app/services/assignments.ts](file:///Users/mac/Documents/School_Management_System/app/services/assignments.ts))
is the closest analog. Reuse:

- `requirePermission(event, slug)` from [auth/rbac.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/rbac.ts)
- `parseBody / parseInput / parseQueryData` from [validation.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/validation.ts)
- `writeAudit(event, entry)` from [audit.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/audit.ts)
- `smsNotFound / smsConflict / smsForbidden / smsFieldError / isPgUniqueViolation / isPgForeignKeyViolation` from [http-errors.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/http-errors.ts)
- `smsPaginate / SmsDb` from [pagination.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/pagination.ts)
- `toJsonModel / toJsonList` from [serialize.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/serialize.ts)
- `uuidSchema / paginationQuerySchema / dateStringSchema / idParamSchema` from [schemas/common.ts](file:///Users/mac/Documents/School_Management_System/app/shared/schemas/common.ts)
- `api / apiFetch` from [services/api.ts](file:///Users/mac/Documents/School_Management_System/app/services/api.ts)
- `Actor / getActor` pattern from [services/assignments.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/assignments.ts#L71-L101) — adapt the staff-permission arg

## Authorization model

- **Assessment types & grading scales**: `exams.create`/`exams.update` (admin/super_admin manage config; teachers can view).
- **Exams CRUD + open/close + exam_subjects**: `exams.create`/`exams.update`. Teachers may only manage exams for classes/subjects they are assigned to that session (mirror `assertCanManage` from [assignments.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/assignments.ts#L206-L216)); admins any.
- **Score entry** (assessment + exam, single and bulk): `exam_results.enter`. Teachers may only enter scores for their assigned class/subject; admins any.
- **Workflow**: `exam_results.submit` (teacher, own class), `exam_results.approve` (admin), `exam_results.publish` (admin/super_admin). State machine: `draft → submitted → approved → published`; backwards transitions blocked. Once `submitted`, scores are locked.
- **Student/parent visibility**: only `published` results visible via `/students/{id}/results` and `published` report cards via `/students/{id}/report-cards`. Parents see only their linked children (mirror the pattern in [parents/[id]/children.get.ts](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/parents/[id]/children.get.ts)).
- **Report cards**: `report_cards.generate` to compute, `report_cards.publish` to publish, `report_cards.view` to read.

## Files

### New — shared schemas + types

- `app/shared/schemas/exams.ts` — zod schemas: `assessmentTypeCreate/Update`, `gradingScaleCreate/Update` (with nested items), `examCreate/Update/List`, `examSubjectUpsert`, `assessmentScoreUpsert` + `assessmentScoreBulk`, `examScoreUpsert` + `examScoreBulk`, `resultPublicationList`, `reportCardGenerate`. Reuse `uuidSchema`, `paginationQuerySchema`, `dateStringSchema`, `moneyStringSchema`.
- Edit `app/shared/schemas/index.ts` — add `export * from './exams'`.
- Edit `app/shared/types/index.ts` — add `AssessmentType`, `GradingScale`, `GradingScaleItem`, `Exam`, `ExamSubject`, `ExamDetail` (with subjects), `AssessmentScore`, `ExamScore`, `ResultPublication`, `ResultPublicationDetail`, `ReportCard`, `StudentResultSummary`, `SubjectResult`.

### New — service layer

- `app/server/services/exams.ts` — one service module covering:
  - Reference validation (session/term/class/section/subject, teacher-class-subject assignment check)
  - Assessment types CRUD
  - Grading scales + items CRUD (transactional replace of items on update)
  - Exams CRUD + open/close + exam_subjects management
  - Score entry: single + bulk upsert for both `assessment_scores` and `exam_scores` (bulk uses `onConflictDoUpdate`)
  - Result publication workflow with state-machine guards and lock-check against submitted/approved/published
  - Grade computation helper: `computeGrade(percentage, gradingScaleItems)` returns the matching grade row
  - Report card generation: aggregate assessment + exam scores for a student/session/term, compute totals/average/overall grade, persist into `report_cards` (idempotent upsert on student+session+term unique index)
  - Student results aggregate view (only when publication status is `published`)
  - Actor model + `assertCanManageExam` + `assertCanEnterScores` helpers (mirror assignments.ts)

### New — API routes (all under `app/server/api/v1/`)

- `assessment-types/index.get.ts` `index.post.ts` `[id].put.ts`
- `grading-scales/index.get.ts` `index.post.ts` `[id].get.ts` `[id].put.ts`
- `exams/index.get.ts` `index.post.ts` `[id].get.ts` `[id].put.ts`
- `exams/[id]/open.post.ts` `exams/[id]/close.post.ts`
- `exams/[id]/subjects.post.ts` `[id]/subjects/[subjectId].put.ts` `[id]/subjects/[subjectId].delete.ts`
- `exams/[id]/scores.put.ts` (bulk exam-score upsert by class)
- `assessment-scores/index.get.ts` `index.post.ts` `bulk.put.ts`
- `exam-results/index.get.ts` `index.post.ts` `[id].get.ts` `[id]/submit.post.ts` `[id]/approve.post.ts` `[id]/publish.post.ts`
- `students/[id]/results.get.ts` `students/[id]/report-cards.get.ts` `students/[id]/report-cards.post.ts`

Each route follows the Phase 6 template: `requirePermission` → parse body/params/query → call service → `writeAudit` → return JSON. Audit actions: `assessment_type.create`, `grading_scale.update`, `exam.create/open/close`, `exam_score.bulk_enter`, `assessment_score.bulk_enter`, `result.submit/approve/publish`, `report_card.generate/publish` (matches README §26 audit categories).

### New — client + frontend

- `app/services/exams.ts` — client API (`examsApi` object) mirroring [services/assignments.ts](file:///Users/mac/Documents/School_Management_System/app/services/assignments.ts): list/get/create/update exams, open/close, subject upsert/delete, bulk score entry, list publications, submit/approve/publish, student results, report-cards get/generate.
- `app/pages/exams.vue` — staff exam management page (mirrors [pages/assignments/index.vue](file:///Users/mac/Documents/School_Management_System/app/pages/assignments/index.vue)): list exams for current session, create exam form (with subject picker + maxScore), open/close buttons, score-entry grid for the exam subjects. `definePageMeta({ permissions: ['exams.view'] })`. Admin sees a "Result publications" panel with submit/approve/publish buttons.
- `app/pages/results.vue` — student/parent view: list of subject results + totals + grade + report-card status. `definePageMeta({ permissions: ['exam_results.view'] })`.

### New — tests

- `app/shared/__tests__/exams.test.ts` — zod schema tests mirroring [assignments.test.ts](file:///Users/mac/Documents/School_Management_System/app/shared/__tests__/assignments.test.ts): grading scale ranges (min < max, no overlap), score bounds, status enum, bulk array shape.

### Edit — seeds

- `app/database/seeds/index.ts` — append Phase 7 block: one `assessment_type` (midterm), one `grading_scale` with 6 grade items (70-100 A … 0-39 F per README §18), one `exam` for Primary 1 First Term with two subjects, exam_subjects, exam_scores for the demo students, and one `result_publication` taken through `draft → submitted → approved → published`, plus a generated `report_card` for STU-001. Idempotent via pre-checks (mirror the assignment seed pattern at [seeds/index.ts#L784-L825](file:///Users/mac/Documents/School_Management_System/app/database/seeds/index.ts#L784-L825)).

### Edit — documentation

- `docs/API.md` — add "Phase 7 — Exams, scores, results & report cards" section listing every endpoint with method/path/permission/description (mirror the Phase 6 tables already present in the file).
- `docs/ARCHITECTURE.md` — change Phase status from "Phase 7 not started" to "Phase 7 complete (PDF deferred)".
- `README.md` — update §41 phase record ("Phase 7 — Exams/results (complete)") and the §47 status line. Do not commit; leave with the existing uncommitted Phase 6 doc changes untouched.

## Verification

Run from `app/`:

```bash
npm run db:migrate     # confirm migrations apply (Phase 7 tables already exist; expect no-op)
npm run db:seed        # confirm Phase 7 seed block idempotent
npm run test           # vitest incl. new app/shared/__tests__/exams.test.ts
npm run type-check     # nuxt typecheck passes with new schemas/routes/types
npm run build          # cloudflare-module Worker build succeeds
```

Manual smoke (optional, after `npm run dev`):

1. Login as `admin@victoriouschildren.school` → `/exams` → create exam → open → bulk-enter scores.
2. As admin → `/exams` publication panel → submit → approve → publish.
3. Login as `student@victoriouschildren.school` → `/results` → see published results + report card.

## Known limitations (to record in docs)

- **PDF generation deferred**. Report cards have metadata + JSON view + workflow only. The `objectKey` column stays null. A later phase will add a Workers-compatible PDF library (e.g. `pdf-lib`) and R2 storage.
- In-memory per-Worker rate limiting limits apply (Phase 12 hardening will revisit).
- Bulk score endpoints cap at 200 rows per request (configurable in `examScoreBulkSchema`).

## Out of scope

- Phase 8 finance, Phase 9 admissions, Phase 10 announcements/notifications.
- Parent notifications on result publication (Phase 10).
- Cron-driven auto-publish for scheduled exams (Phase 10).
