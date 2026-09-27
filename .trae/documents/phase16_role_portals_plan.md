# Phase 16 — Dedicated Role Portals (Plan)

Owner decisions (2026-09-27, via AskUserQuestion):
1. **Portal entry:** student/parent/teacher roles are redirected to their
   `/portal/*` home after login; staff/admin keep the current dashboard.
2. **Enrollment:** view-status only in the student/parent portals —
   registration stays with staff (no new write path).
3. **CSV scores:** **multi-subject file** — CSV carries a `subject_code`
   column; one file can cover many subjects.
4. **Lesson notes:** text **+ R2 attachments**.

Everything else reuses existing APIs/services. Standing rules apply: zod
validation, server-side authorization, Vitest, gates after each increment
(`npm run type-check`, `npm run test`, `npm run build` from `app/`), cf:dev
smoke, docs sweep, manual Wrangler deploys only, no commits unless asked.

## Existing building blocks (verified)

| Need | Already exists |
|---|---|
| Role-scoped data | `server/services/students-self.ts`, `parents-self.ts`, `teachers-self.ts` (getTeacherSelf, listMyClasses, listMyStudents, listSubmissionsToGrade) |
| Attendance recorder flow | `pages/attendance.vue` (session open → active enrollments → `scheduleApi.markAttendance`) + full API under `api/v1/attendance/*` |
| Scores + workflow | `exam_scores` table (single score ×100 per exam-subject/student), `api/v1/exam-results/*` (create/submit/approve/publish), `pages/exam-results/enter.vue` |
| Report cards | `api/v1/report-cards/[id]/pdf.get.ts` + `publish.post.ts`; student listing via `examsApi.listStudentReportCards` |
| Fees (parent) | `pages/billing.vue` — Paystack checkout, QR, bank details, receipts (Phase 15) |
| Messaging | `services/communication.ts` `sendMessage` (any existing user recipient), `api/v1/messages/*` |
| Timetable | `api/v1/timetable/*` + `pages/timetable.vue` |
| Auth gating | `middleware/auth.global.ts` checks `meta.permissions` |
| Missing | `/portal/*` shells, lesson notes (no table; next migration **0003**), CSV upload (only CSV export exists), parent→teacher discovery, dashboards |

## Increments

### 16A — Portal shells + student portal

Backend:
- `GET /api/v1/students/me/dashboard` (students-self): current class +
  enrollment, today's/week timetable, upcoming assignment deadlines (open,
  not yet submitted), recent exam scores (last N, with subject names),
  attendance summary (present/late/absent counts for current term).
  Reuses existing scoped queries; one endpoint to keep the dashboard to a
  single round-trip.

Frontend:
- `app/layouts/portal.vue` — branded shell (school name/logo from
  school-settings), role-scoped nav, sign-out. Distinct from the staff
  layout; no admin nav leaks.
- `app/pages/portal/student/index.vue` — dashboard cards: current class,
  timetable (today + full week), upcoming deadlines, recent grades,
  attendance summary.
- `app/pages/portal/student/resources.vue` — learning resources browser
  reusing the resources API (student-scoped visibility as already
  enforced server-side).
- `app/pages/portal/student/enrollment.vue` — **view-only**: current
  enrollment (class, session, status) + academic history list.
- Login redirect: after successful login, resolve primary role →
  `navigateTo('/portal/student' | '/portal/parent' | '/portal/teacher')`;
  staff/admin unchanged. Global middleware: redirect these roles from
  `/` to their portal home.

Tests: dashboard service scoping tests (student sees own data only),
route tests, login-redirect unit tests.

### 16B — Parent portal

Backend:
- `GET /api/v1/parents/me/teachers` (parents-self): deduped list of the
  children's class teachers + subject teachers (id, name, role label) to
  power the message composer. Existing `sendMessage` is reused as-is
  (recipient must exist; permission `messages.send` already required).

Frontend:
- `app/pages/portal/parent/index.vue` — child switcher (existing
  parents-self children list); per-child summary: termly + cumulative
  progress (averages per subject from published scores), attendance
  snapshot, outstanding fees.
- `app/pages/portal/parent/attendance.vue` — attendance dashboard per
  child (records by day, summary counts).
- `app/pages/portal/parent/fees.vue` — moves/reuses the Phase 15
  billing.vue content (checkout, QR, bank details, receipts) keyed by the
  selected child; `billing.vue` remains for compatibility or is reduced
  to a redirect.
- `app/pages/portal/parent/report-cards.vue` — published report cards
  with PDF download (existing scoped endpoints).
- `app/pages/portal/parent/messages.vue` — compose to a child's teacher
  (prefilled recipient picker from the new endpoint) + inbox threading
  reusing `messagesApi`.

Tests: parents/me/teachers scoping (only own children's teachers;
parents of no children get empty), route tests.

### 16C — Teacher portal core

Frontend (backend mostly exists):
- `app/pages/portal/teacher/index.vue` — class dashboard from
  `teachers-self`: my classes, my students, submissions to grade,
  quick stats.
- `app/pages/portal/teacher/attendance.vue` — checkbox recorder: pick
  class + date → open/create session → mark present/late/absent per
  student → save → submit for approval (mirrors attendance.vue flow on
  the portal layout).
- `app/pages/portal/teacher/performance.vue` — per class + exam-subject
  averages/distribution from published scores (reuses exam-results
  listing endpoints; new small aggregation endpoint only if the existing
  ones don't suffice — prefer reuse).

Tests: reuse existing service tests; new route tests for any added
aggregation endpoint.

### 16D — Teacher tools: CSV scores, lesson notes, submission flow

Backend:
- **Bulk scores (multi-subject CSV):**
  - `POST /api/v1/exam-results/bulk-preview` — body: examId + parsed rows
    (`admissionNumber`, `subjectCode`, `score`). Validates: exam open for
    entry, teacher owns the exam-subjects (or has `exam_results.enter`),
    student enrolled in the class, subject belongs to the exam, score ≤
    max × 100, no duplicate rows in-file. Returns per-row OK/error.
  - `POST /api/v1/exam-results/bulk` — commits valid rows as upserts on
    (examSubjectId, studentId) with `enteredById`, in a transaction;
    per-row results returned; audited.
  - CSV **parsing happens client-side** (small dependency-free parser in
    `app/shared/utils/csv.ts`, unit-tested) — Workers-friendly, preview
    UX identical for API errors.
- **Lesson notes:** migration `0003_lesson_notes.sql`:
  `lesson_notes` (id, teacherId → teachers, classId, subjectId,
  sessionId, termId nullable, week integer nullable, title, content,
  timestamps) and `lesson_note_files` (id, noteId → cascade, objectKey,
  fileName, mimeType, sizeBytes, uploadedById, createdAt). Service
  `server/services/lesson-notes.ts`: CRUD scoped to owning teacher
  (admins/`lesson_notes.manage` view all); attachment upload via existing
  multipart/R2 utils to prefix `lesson-notes/`, download through an
  authorized route (`Cache-Control: private, no-store`).
  Routes: `GET/POST /api/v1/lesson-notes`, `GET/PATCH/DELETE
  /api/v1/lesson-notes/[id]`, `POST /api/v1/lesson-notes/[id]/files`,
  `GET /api/v1/lesson-notes/[id]/files/[fileId]` (download),
  `DELETE /api/v1/lesson-notes/[id]/files/[fileId]`.
  New permission slugs added to the RBAC seed (e.g.
  `lesson_notes.view/manage`) following the existing 104-slug pattern.
- **Grade submission → report cards:** portal flow wraps existing
  endpoints: exam-results submit → (approver) approve → publish →
  report-card PDF (publish.post.ts, pdf.get.ts). No new backend unless a
  gap appears during implementation.

Frontend:
- `app/pages/portal/teacher/scores.vue` — choose exam + class → attach
  CSV → preview table (green OK rows, red per-row errors) → commit →
  results summary. Manual entry still links to the existing
  `exam-results/enter.vue`.
- `app/pages/portal/teacher/lesson-notes.vue` — list/filter (class,
  subject, term), editor drawer (title, week, content), attachment
  upload/download/delete.

Tests: CSV parser units; bulk-preview/bulk service scoping + validation
tests (unauthorized subject, unenrolled student, oversize score,
duplicate rows, idempotent upsert); lesson-notes service + route tests
including attachment authorization (non-owner 404/403, parent no access).

## Documentation (after final increment)

README §41 Phase 16 → ✅ with delivered scope; §46/§47 current-phase;
§51 changelog entry. `docs/API.md` Phase 16 section (all new endpoints +
contract details). `docs/SECURITY.md` — portal scoping notes, lesson-note
attachment authorization. `docs/CLOUDFLARE.md` — `lesson-notes/` R2
prefix. `.env.example` unchanged (no new secrets).

## Smoke plan (per increment, cf:dev)

Seeded logins: admin, teacher, parent, student (`password123`). Verify:
role redirects after login; student dashboard data only for self; parent
child switcher + fees reuse; teacher attendance round-trip; CSV upload
happy path + error rows; lesson notes CRUD + attachment round-trip;
authorization negatives (parent → lesson notes 403, cross-child 404).

## Explicitly out of scope

- Public website (Phase 18, plan on hold), email/SMS providers (Phase 17).
- Online registration write paths (decision #2).
- No production deploy; no commits.
