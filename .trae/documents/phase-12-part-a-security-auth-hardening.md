# Phase 12 Part A — Security & Authorization Hardening

## Context

Phase 11 (Reports/audit) is complete. Phase 12 ("Hardening") bundles many
deferred items: security, authorization, file security, rate limits, queues,
performance, accessibility, staging review. Per the "keep changes small and
reviewable" rule (README §15.15) and the user's Option-A-first preference,
Phase 12 is split into reviewable increments.

**Part A scope = security & authorization hardening** (the first three words
of the Phase 12 brief). It closes two concrete, self-contained gaps that are
explicitly flagged as "deferred to Phase 12" in code comments:

1. **File upload magic-byte sniffing** — `uploads.ts` currently validates only
   the *declared* MIME + extension + size. A comment at
   [uploads.ts:26-28](file:///Users/mac/Documents/School_Management_System/app/server/utils/uploads.ts#L26-L28)
   states "Magic-byte content sniffing is deferred to Phase 12 hardening." An
   attacker can upload a hostile file (e.g. an EXE) with a `.pdf` name and
   `application/pdf` declared type and it is accepted.

2. **Row-level scoping for timetable/attendance** — `listTimetableEntries`
   ([schedule.ts:193-221](file:///Users/mac/Documents/School_Management_System/app/server/services/schedule.ts#L193-L221))
   is purely filter-driven: if the caller does not pass `teacherId`, every
   timetable row in the school is returned. README §1380 confirms
   "Student/parent attendance views are permission-gated but not yet
   row-scoped to 'own timetable/own children' … row-level scoping is Phase 12
   hardening." The `AuthContext`
   ([context.ts:15-27](file:///Users/mac/Documents/School_Management_System/app/server/utils/auth/context.ts#L15-L27))
   carries no business ids; actor resolution is duplicated per service
   (assignments.ts `getActor` L78, exams.ts `getMySchoolContext`).

Part B (immediate follow-up) will cover the queue consumer + async
notification path; Part C the export/PDF/thumbnail features. Those need new
infra/deps and are out of scope here.

---

## A1 — File upload magic-byte content sniffing

### New pure function: `sniffMagicBytes`

Add to [app/server/utils/uploads.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/uploads.ts)
(keep `validateUpload` pure; the sniff is a separate pure helper so it stays
unit-testable without file I/O):

```ts
// Sniffs the leading bytes of an uploaded file and returns a canonical
// MIME family when a strong signature matches, or null for unknown.
export function sniffMagicBytes(bytes: Uint8Array): string | null
```

Recognised signatures (strong, unambiguous):
- `application/pdf` — `%PDF-`
- `image/png` — `89 50 4E 47 0D 0A 1A 0A`
- `image/jpeg` — `FF D8 FF`
- `image/gif` — `GIF8`
- `image/webp` — `RIFF....WEBP` (offset 0 RIFF, offset 8 WEBP)
- `image/svg+xml` — leading `<svg` or `<?xml`…`<svg` (text sniff; only when
  declared MIME is `image/svg+xml`)
- `application/zip` — `50 4B 03 04` (covers OOXML `.docx/.xlsx/.pptx` since
  they are ZIP containers; the declared MIME + extension cross-check in
  `validateUpload` already disambiguates which Office flavor)
- `application/msword` / `application/vnd.ms-*` (legacy OLE) — `D0 CF 11 E0 A1 B1 1A E1`
- `text/plain` heuristic — first 512 bytes are printable ASCII / UTF-8
  (including optional BOM); only used to confirm `text/*` declared types.

Return `null` when no signature matches (do NOT reject — the policy is to
catch obvious lies, not to be a complete MIME database; unknown types fall
back to the declared-MIME check already done by `validateUpload`).

### New validator: `assertSniffMatchesDeclared`

Add to `uploads.ts`:

```ts
// Throws an Error (routes map to 422) when the sniffed family is
// incompatible with the declared MIME. Compatible = sniff is null
// (unknown), OR sniff equals the declared MIME, OR sniff is the
// container family of the declared type (e.g. sniff application/zip
// is compatible with declared application/vnd.openxmlformats…).
export function assertSniffMatchesDeclared(
  sniffed: string | null,
  declaredMime: string,
): void
```

Compatibility rules (kept conservative):
- `sniffed == null` → pass (unknown content, trust declared check).
- `sniffed === declaredMime` → pass.
- sniffed `application/zip` compatible with declared
  `application/vnd.openxmlformats-officedocument.*` or `application/zip` → pass.
- sniffed legacy-OLE compatible with declared
  `application/msword` / `application/vnd.ms-excel` /
  `application/vnd.ms-powerpoint` → pass.
- sniffed `text/plain` compatible with declared `text/*` → pass.
- sniffed `image/svg+xml` compatible with declared `image/svg+xml` → pass.
- any other mismatch → throw "File content does not match the declared type."

### Integration into `readUpload`

Modify [app/server/utils/multipart.ts](file:///Users/mac/Documents/School_Management_System/app/server/utils/multipart.ts)
`readUpload` so that AFTER `validateUpload` succeeds it:

1. Reads the leading bytes via `file.slice(0, 512).arrayBuffer()` (Web File API
   works on both Node dev and Workers; slice avoids loading the whole file).
2. Calls `sniffMagicBytes(new Uint8Array(bytes))`.
3. Calls `assertSniffMatchesDeclared(sniffed, meta.mimeType)` inside the
   existing try/catch → 422 on mismatch (reuses `fileError`).

`validateUpload` stays pure and unchanged; the sniff is an additive layer in
the multipart helper. All 5 upload routes
(assignments attachments, submissions, gallery images, resources, admission
documents) inherit the sniff from the single `readUpload` call site.

### Tests — `app/server/utils/__tests__/uploads.test.ts`

Add cases (pure, no file I/O):
- Each recognised signature byte sequence → expected canonical family.
- Unknown bytes → null.
- `assertSniffMatchesDeclared`: pass cases (null sniff; equal; zip vs OOXML;
  OLE vs msword; text/plain vs text/csv; svg) and reject cases (sniff pdf vs
  declared image/png; sniff png vs declared application/pdf; sniff exe-ish
  `4D 5A` vs declared application/pdf → null passes? No — `4D 5A` is not a
  recognised signature so sniff returns null and passes; document this is
  acceptable since declared MIME + extension check still rejects `.exe`
  named as `.pdf` via the extension cross-check in `validateUpload`).

Verify the extension cross-check in `validateUpload` already rejects a `.exe`
named `.pdf` (declared `application/pdf`, ext `exe` → not in `MIME_EXTENSIONS['application/pdf']`).
If there is a hole, add an explicit extension-vs-declared rejection. Confirm
in the audit step.

---

## A2 — Shared actor-profile helper + timetable/attendance scoping

### New helper: `app/server/utils/auth/actor.ts`

Centralises the per-service actor resolution that `assignments.ts:getActor`
and `exams.ts:getMySchoolContext` already do ad-hoc. Does NOT touch the auth
middleware hot path (`loadUserGrants`) — resolved lazily only by services that
need row-level scoping, and cached per request on `event.context.actorProfile`.

```ts
export interface ActorProfile {
  userId: string
  isStaff: boolean          // caller holds the staff permission for the route
  teacherId: string | null
  studentId: string | null
  staffProfileId: string | null
  children: string[]       // student ids, for parents
}

export async function resolveActorProfile(
  event: H3Event,
  staffPermission: string,
): Promise<ActorProfile>
// 1. read event.context.actorProfile (cache hit → return)
// 2. query teachers/students/staff_profiles by userId (active only)
// 3. query parent_student_links for children when the user is a parent
// 4. cache + return
```

Reuses the existing `teachers.userId`, `students.userId`, `staff_profiles.userId`,
`parent_student_links.parentId` columns (already indexed in the schema). Runs
3 small SELECTs (or one with subselects) — cheap, and only on scoped routes.

### Refactor existing ad-hoc resolution

- `assignments.ts:getActor` → delegate to `resolveActorProfile(event, 'assignments.create')`
  and drop its local teacher/student lookup. Keeps the `Actor` shape the
  assignments service already uses (map fields).
- `exams.ts:getMySchoolContext` → keep the public API shape, but internally
  call `resolveActorProfile` to get `studentId`/`children` instead of its own
  queries. Behaviour-preserving.

This removes duplication and gives every scoped service a single source of
truth for "who is the caller as a business entity."

### Apply row-level scoping in `schedule.ts`

Add an optional `actor: ActorProfile | null` parameter to the relevant
service functions; the route layer resolves the actor and passes it. The
service applies scoping ONLY when the actor is a non-staff teacher or
student/parent — staff (admins, and staff-role holders with the staff
permission) continue to see everything (their explicit filters still apply).

**Timetable list** — `listTimetableEntries(query, actor?)`:
- Non-staff teacher: if `query.teacherId` is absent OR equals `actor.teacherId`,
  force `where.push(eq(timetableEntries.teacherId, actor.teacherId))`. If the
  caller passes a *different* `teacherId`, return 403 (do not silently
  return empty — surface the auth boundary) OR ignore the foreign id and
  scope to self. Decision: **scope to self and ignore the foreign filter**
  (matches the "staff see all, teachers see own" UX; a 403 on a list is
  surprising). Document this.
- Non-staff student: restrict to `classId IN (their active enrollment classIds
  for the session)`. No `teacherId` filter. A student passing an arbitrary
  `teacherId`/`classId` outside their enrollments gets those filters ANDed
  with their enrollment scope (so they see at most their own class timetable).
- Non-staff parent: restrict to `classId IN (children's active enrollment
  classIds)`.
- Staff (actor.isStaff): no extra scoping (current behaviour).

**Attendance** — `listAttendanceSessions`, `classReport`, `studentHistory`
([schedule.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/schedule.ts)):
- Non-staff teacher: scope `classId` to the classes they teach
  (`teacher_class_assignments` / `teacher_assignments` for the session). For
  `studentHistory`, restrict to students in those classes.
- Non-staff student: `studentHistory` only for themselves (ignore/override
  the `studentId` param to self); `listAttendanceSessions`/`classReport` →
  their own enrolled class only.
- Non-staff parent: `studentHistory` only for own children; list/report →
  children's classes only.
- Staff: unchanged.

### Route wiring

Update the thin Nitro route handlers under
`app/server/api/v1/timetable/` and `app/server/api/v1/attendance/` to:
1. `const auth = requirePermission(event, '<slug>')`
2. `const actor = await resolveActorProfile(event, '<slug>')`
3. pass `actor` into the service call.

No new permissions, no migrations, no schema changes.

### Tests

No live PostgreSQL on the dev box for endpoint tests, so scoping is covered
by:
- Pure unit tests of the `ActorProfile`-aware WHERE-clause builder. Extract
  the scope-clause builder as a pure function `buildActorScopeClauses(actor,
  query)` returning `SQL[]`, and unit-test the teacher/student/parent/staff
  branches (mirrors how `time.ts` overlap helper is tested).
- A `resolveActorProfile` mock-based test (stub the db) asserting caching and
  correct field mapping.

---

## A3 — Audit of assignments/exams teacher scoping

`assignments.ts:listAssignments`
([L268-317](file:///Users/mac/Documents/School_Management_System/app/server/services/assignments.ts#L268-L317))
already scopes non-staff students to published + enrolled classes; teachers
are treated as staff (`isStaff = permissions.includes('assignments.create')`)
and see all, which matches the API doc ("Staff see all"). **No change** —
document the decision in the plan's Known Limitations.

`exams.ts` already has teacher-assigned-class/subject checks for score entry
and `getMySchoolContext` for student/parent self/children. Audit the exam
*list* endpoint for a teacher-scoping gap; if a teacher list shows all
school exams, apply the same `actor` pattern. If small, patch in this
increment; if it requires cross-service work, defer to Part B with a note.

---

## Documentation

- `docs/API.md`: add a `## Phase 12 — Hardening (Part A)` section documenting
  the magic-byte sniff behaviour (declared vs sniffed MIME compatibility
  rules, 422 on mismatch) and the row-level scoping rules for timetable/
  attendance (teachers see own classes; students see own enrollments; parents
  see children; staff see all; foreign filters are silently constrained to
  own scope).
- `README.md`: update §Current phase to "Phase 12 Part A — Security & auth
  hardening (in progress/complete)"; move the magic-byte and row-level
  scoping bullets out of the deferred list; append a changelog entry.
- No new README files (single master README rule).

## Verification

From `app/`:
1. `npm run test` — existing 272 tests still pass + new uploads/sniff and
   scope-clause tests pass.
2. `npm run type-check` — exit 0.
3. `npm run build` — cloudflare-module build succeeds.
4. `npm run db:seed` — still idempotent (no schema change).
5. Smoke (manual, `npm run cf:dev`): upload a renamed EXE as `.pdf` → 422;
   upload a real PDF → 201; as a teacher, `GET /api/v1/timetable` returns
   only own entries; as a student, `GET /api/v1/attendance/students/{id}`
   for another student → scoped/empty or 403.

## Files to change

- `app/server/utils/uploads.ts` — add `sniffMagicBytes`, `assertSniffMatchesDeclared`.
- `app/server/utils/multipart.ts` — call sniff in `readUpload`.
- `app/server/utils/__tests__/uploads.test.ts` — sniff + compatibility tests.
- `app/server/utils/auth/actor.ts` — NEW shared `resolveActorProfile` + helper.
- `app/server/utils/auth/context.ts` — declare `event.context.actorProfile` extension.
- `app/server/services/schedule.ts` — add `actor` param + scope clauses to timetable/attendance list/report functions; extract `buildActorScopeClauses`.
- `app/server/services/assignments.ts` — delegate `getActor` to `resolveActorProfile` (behaviour-preserving).
- `app/server/services/exams.ts` — delegate `getMySchoolContext` to `resolveActorProfile` (behaviour-preserving).
- `app/server/services/__tests__/` — NEW pure scope-clause + actor tests.
- `app/server/api/v1/timetable/**` and `app/server/api/v1/attendance/**` route handlers — resolve actor and pass through.
- `docs/API.md`, `README.md` — Phase 12 Part A docs + changelog.

## Out of scope (deferred)

- Queue consumer + async notification/email path (Part B).
- PDF report cards, PDF audit certificates, Excel/.xlsx exports,
  admissions-pipeline report, gallery thumbnails (Part C — needs new deps).
- Shared KV/Durable-Object rate limiter and session revocation list
  (infra-dependent; candidate for Phase 13 production readiness).
- Performance, accessibility, staging review (later Phase 12 sub-parts).
