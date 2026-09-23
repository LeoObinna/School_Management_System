# Phase 7 — Teacher Self-Service (Option A scope)

## Context

Phase 6 (admin gaps) shipped at commit a2d4e27. Per the owner's amended execution order, Phase 7 — Teacher is next (Phase 5 public website DEFERRED; Phase 10 Paystack deferred to last). All work stays LOCAL + wrangler dev only — do NOT disturb live PG staging.

**Why this phase exists:** Today the teacher logs in and sees the admin dashboard. The existing `*.view`-gated pages (`/attendance`, `/exams`, `/assignments`, `/timetable`, `/results`) show all rows; row-level scoping happens (inconsistently) at the API layer. There is no teacher-self-service landing page, no "my classes / my students / submissions to grade" surface, and no teacher dashboard widget. Per spec 04_APPFLOW §6 (teacher attendance) + §7 (teacher results) + 06_IMPLEMENTATION_PLAN Phase 7 ("Assigned classes, attendance, assessments, results, assignments, resources and permitted communication"), the teacher needs a scoped self-service experience.

**Pre-flight findings (don't recreate):**
- ✅ Already actor-scoped via `resolveActorProfile` from `app/server/utils/auth/actor.ts`: `attendance/sessions/index.get.ts`, `exams/index.get.ts`, `timetable/index.get.ts`
- ❌ NOT scoped / uses old ad-hoc resolver: `assignments/index.get.ts` (uses `assignments.ts:getActor` — duplicated logic, scoping incomplete for teachers), `assignments/[id]/submissions.get.ts`, `exam-results/index.get.ts` (no actor at all), `teacher-assignments/index.get.ts` (admin-only `teacher_assignments.manage` permission, no self-service variant)
- ❌ No `/teachers/me`, `/my-classes`, `/my-students`, `/submissions/to-grade`, `/exam-results/enter` pages exist
- ❌ `pages/index.vue` dashboard has only an admin (`reports.view`) section
- The centralized actor infrastructure (`resolveActorBusinessIds`, `resolveActorProfile`, `classifyActorScope`, `teacherTaughtClassIds`, `studentEnrolledClassIds`) already exists and is the canonical pattern — `assignments.ts:getActor` is duplicated logic that should migrate to it

## Scope (Option A — minimum viable; Option B = follow-up; Option C = deferred pending owner sign-off)

Per owner preference: implement Option A first; Option B as immediate follow-up; explicit permission required before Option C.

### Option A — Self-service landing + scoping fix (this phase)

1. **Migrate `assignments` service off the duplicated `getActor`** onto `resolveActorProfile(event, 'assignments.manage')` from `app/server/utils/auth/actor.ts`. Replace the `Actor` param shape across `listAssignments` / `getAssignmentForActor` / `assertCanManage` / `createAssignment` / `updateAssignment` / `deleteAssignment` / `listSubmissions` / `submitSubmission` / `gradeSubmission` etc. with `ActorProfile`. The teacher-branch must scope by `actor.teacherId` (use `teacherTaughtClassIds` for the class filter; for submissions-to-grade, filter `assignments.teacherId = actor.teacherId AND submissions.status = 'submitted'`). Keep behavior identical for staff/students. Drop the `getActor` function + its DB hit (the new resolver is request-cached).
2. **Add actor scoping to `exam-results/index.get.ts`** — call `resolveActorProfile(event, 'exam_results.enter')` and pass `actor` into `listPublications`; scope teachers to results whose exam belongs to one of their taught classes (reuse `teacherTaughtClassIds`).
3. **New endpoint `GET /api/v1/teachers/me`** — returns the logged-in teacher's profile + assigned classes (with sections + subjects per class, via `teacherClassAssignments`) + today's timetable (count or top N) + pending submissions-to-grade count + 5 most-recent announcements. Uses `resolveActorBusinessIds` to get `teacherId`; 404 if caller has no teacher profile. Gated by `dashboard.view`.
4. **New page `/teachers/me` (or `/my` — pick one, `/teachers/me` is more discoverable)** — calls `GET /teachers/me`, renders: profile card (name, staff number, subjects count), "My Classes" mini-grid, "Today's Timetable" list, "Submissions to grade: N" link, "Recent Announcements" list. Gated by `dashboard.view` + caller must have a teacher profile (show empty-state otherwise).
5. **New page `/my-classes`** — lists the teacher's `teacherClassAssignments` (calls existing `GET /teacher-assignments?teacherId=me` after fix #6 below, OR a new `GET /teachers/me/classes` thin wrapper). Each row: class · section · subject · session · isPrimaryTeacher. Click → `/my-students?classId=…`.
6. **Add self-service variant `GET /api/v1/teacher-assignments/me`** — same as existing `GET /teacher-assignments` but takes NO `teacherId` query param; resolves `teacherId` from `resolveActorBusinessIds`. Gated by `teacher_assignments.view` (new permission slug? NO — reuse `teachers.view`, the teacher viewing their own assignments is `teachers.view`-covered). Returns the same shape as the admin endpoint.
7. **New page `/my-students`** — roster of students enrolled in the teacher's assigned classes/sections (filtered by `?classId=`). Calls existing `GET /students?classId=…` (already scoped server-side to caller's taught classes via actor resolver — verify; if not, scope it). Each row: name · admission number · class · section · guardians contact.
8. **New page `/submissions/to-grade`** — calls `GET /assignments?toGrade=1&status=submitted` (or a new `GET /assignments/me/to-grade` thin wrapper). Lists assignments with pending submissions; click → existing `/assignments/[id]` grading view (already exists).
9. **Dashboard widget on `pages/index.vue`** — add a teacher-specific section gated by `dashboard.view` AND `auth has teacherId` (use a new `auth.teacherId` getter from `GET /auth/me` if it doesn't already expose it; check first). Calls `GET /teachers/me`, renders the same compact cards as the admin dashboard but teacher-scoped (My Classes count, Today's Periods count, Submissions to Grade count). Add a "View my dashboard" link to `/teachers/me`.
10. **Client wrappers in `app/services/teachers.ts`** (new file, or extend existing people.ts — check first) — `teachersApi.getMe()`, `teachersApi.myClasses()`, `teachersApi.myStudents(query)`, `teachersApi.submissionsToGrade()`.
11. **Shared types in `app/shared/types/index.ts`** — `TeacherSelf` (profile + classes + todayTimetable + pendingSubmissionsCount + recentAnnouncements), `TeacherClassRow` (reuse `TeacherClassAssignmentDetail` from teacher-academics), `TeacherStudentRow`.
12. **Tests** — `app/shared/__tests__/teachers.test.ts` (zod schema for any new query params) + extend `app/server/services/__tests__` if assignments service refactor changes behavior. Run full gate suite (typecheck + vitest + build + D1 smoke).

### Option B — Follow-up after Option A ships (do NOT start without owner nod)

- `/exam-results/enter` — the full score-entry workflow UI (session → term → class/subject → enter scores → save draft → submit → admin review → approve → publish per AppFlow §7). Backend exists (`/exam-results/*` routes); only UI missing.
- `/my-timetable` separate page (or confirm `/timetable` already auto-scopes to the teacher — it does per pre-flight; may not need a separate page).
- `/teachers/me` deep-links: "My Subjects" tab, "My Attendance Sessions" tab, "My Exam Results" tab.
- Replace `assignments.ts:getActor` with `resolveActorProfile` everywhere it's still ad-hoc (the submission/grading routes).

### Option C — Deferred (requires explicit owner permission)

- Splitting the admin `/assignments` page from a teacher `/assignments` page if their UX diverges significantly (rather than one page with conditional columns).
- A teacher-only landing at `/` (route guard by role) instead of a shared dashboard with conditional sections.
- Real-time notifications via WebSocket/SSE for new submissions (currently cron+queue only).

## Files to touch (Option A)

**New:**
- `app/server/api/v1/teachers/me.get.ts` — self-service dashboard payload
- `app/server/api/v1/teachers/me/classes.get.ts` — thin wrapper over teacher-assignments scoped to me (if needed; may reuse `/teacher-assignments/me`)
- `app/server/api/v1/teacher-assignments/me.get.ts` — self-service variant
- `app/server/services/teachers-self.ts` — `getTeacherSelf()`, `listMyClasses()`, `listMyStudents()`, `listSubmissionsToGrade()` (or extend `teacher-academics.ts` — prefer a new service to keep teacher-academics focused on admin CRUD)
- `app/pages/teachers/me.vue` — self-service landing
- `app/pages/my-classes.vue` (or `app/pages/teachers/me/classes.vue` — pick a convention; prefer the latter for nested layout)
- `app/pages/my-students.vue` (or nested)
- `app/pages/submissions/to-grade.vue` (or nested under `/teachers/me`)
- `app/services/teachers.ts` — client wrappers (if not already present)
- `app/shared/__tests__/teachers.test.ts` — schema tests

**Edited:**
- `app/server/services/assignments.ts` — migrate `getActor` → `resolveActorProfile`; add teacher scoping to `listAssignments` + `listSubmissions`
- `app/server/api/v1/assignments/index.get.ts` — use `resolveActorProfile`
- `app/server/api/v1/assignments/[id]/submissions.get.ts` — use `resolveActorProfile`
- `app/server/api/v1/exam-results/index.get.ts` — use `resolveActorProfile`, scope teachers to taught classes
- `app/server/services/exam-results.ts` (or wherever `listPublications` lives) — accept `actor` param, scope by `teacherTaughtClassIds`
- `app/pages/index.vue` — add teacher dashboard section
- `app/shared/types/index.ts` — add `TeacherSelf`, `TeacherStudentRow`
- `app/shared/schemas/teachers.ts` — zod query schema for `me` endpoints (if any input)
- `app/shared/schemas/index.ts` — barrel re-export
- `app/stores/auth.ts` — add `teacherId` getter if `GET /auth/me` exposes it (check first; if not, the `/teachers/me` page can resolve it server-side)

**Reused (do NOT modify):**
- `app/server/utils/auth/actor.ts` — `resolveActorBusinessIds`, `resolveActorProfile`, `classifyActorScope`, `teacherTaughtClassIds`, `studentEnrolledClassIds`
- `app/server/services/teacher-academics.ts` — `listAssignments` (the teacher-class-assignments list — confusingly named same as the assignments-service function; careful with imports)
- `app/server/utils/auth/context.ts` — `loadUserGrants`
- `app/server/utils/pagination.ts` — `runBatch`, `D1BatchItem`, `chunkRows`, `SmsDb`
- `app/server/utils/http-errors.ts` — `smsNotFound`, `smsFieldError`, `smsConflict`
- D1 conventions locked from Phase 3 (TEXT UUIDs, INTEGER booleans, `like` not `ilike`, `db.get`/`db.run`+`meta.changes`, `group_concat(DISTINCT ${col})` with column ref in `.select()` builder, dual violation codes 23505/23503 + 2067/787)

## Verification

1. `cd app && npm run type-check` → EXIT 0
2. `cd app && npm run test` → all pass (432 + new tests)
3. `cd app && npm run build` → EXIT 0 (no wrangler in .output)
4. Local D1 smoke (wrangler dev + curl with cookie jar + x-csrf-token header):
   - Seed: `npm run db:d1:migrate && npm run db:d1:seed` (already done; just verify a teacher account exists)
   - Login as a seeded teacher (e.g. `teacher@victoriouschildren.school` — verify in seeds)
   - `GET /auth/me` → confirm `teacherId` is in the response (or note it's missing for fix #)
   - `GET /teachers/me` → 200 with profile + classes + today's timetable + pendingSubmissionsCount + recentAnnouncements
   - `GET /teachers/me` as admin (no teacher profile) → 404 with friendly message
   - `GET /teacher-assignments/me` → 200 with only the calling teacher's assignments
   - `GET /assignments` as teacher → only the teacher's assignments (not all)
   - `GET /assignments/[id]/submissions` as teacher → 200 if teacher owns the assignment, 403 otherwise
   - `GET /exam-results` as teacher → only results for exams in the teacher's taught classes
   - `GET /my-students?classId=X` → only students in classes the teacher teaches; 403 if classId is not one of theirs
   - `/teachers/me` page renders all sections; `/my-classes`, `/my-students`, `/submissions/to-grade` render
   - Dashboard widget on `/` shows for teacher login; hidden for admin (or shows admin variant)
   - Audit: read-only endpoints don't write audit_log; verify no spurious audit entries
5. Update README §51 changelog (append below Phase 6 entry) + project_memory.md (Phase 7 COMPLETE, NEXT Phase 8 Student)
6. Commit with HEREDOC message; STOP before Phase 8 per precedent
