# API Design

## Conventions

- Base path: `/api/v1`
- Runtime: Nuxt 4 / Nitro server routes (deployed as a Cloudflare
  Pages Worker). There is no separate Laravel service.
- Content-Type: `application/json`
- Authentication: signed, `HttpOnly` cookie session created by
  `POST /auth/login`. The client must send the session cookie
  automatically (`credentials: 'include'`).
- CSRF: state-changing requests (`POST`/`PUT`/`PATCH`/`DELETE`) must
  carry the `x-csrf-token` header issued at login. The Nitro CSRF
  middleware enforces this server-side.
- Authorization: every route checks a permission slug
  (`requirePermission(event, '<slug>')`). Client-side guards are
  convenience only; the server is authoritative.
- Slugs are always derived server-side from names — clients never
  submit them.
- Time-stamped "delete" endpoints for academic structure resources
  deactivate (`isActive = false`) rather than physically delete, so
  historical records stay intact.

## Pagination

List endpoints accept `page` (default 1) and `perPage` (default 20,
max 100), plus resource-specific filters (`search`, `isActive`,
`sessionId`, `classId`, …). Boolean query params accept `"true"`,
`"1"`, `"false"`, `"0"` — note `?isActive=false` is handled
explicitly because `Boolean("false")` is `true` in JavaScript.

Paginated responses use this envelope:

```json
{
  "data": [],
  "meta": {
    "currentPage": 1,
    "perPage": 20,
    "total": 0,
    "lastPage": 1
  }
}
```

A few lookup endpoints (teacher lookup, teacher-subject lists,
teacher assignments) return a lighter `{ "data": [...] }` envelope
and nested class-subject lists return a bare JSON array.

## Error response format

```json
{
  "message": "Human-readable summary",
  "data": {
    "errors": {
      "field_name": ["Validation message"]
    }
  }
}
```

HTTP status codes:

| Code | Meaning                              |
|------|--------------------------------------|
| 200  | OK                                   |
| 201  | Created                              |
| 400  | Bad request (malformed parameters)   |
| 401  | Unauthenticated                      |
| 403  | Forbidden (authorization failed)     |
| 404  | Not found                            |
| 409  | Conflict (duplicate / invariant)     |
| 422  | Validation error                     |
| 429  | Rate limited                         |
| 500  | Server error (never expose SQL/trace)|

`409` is returned for duplicate slugs/links (e.g. adding a subject a
class already offers) and for broken relation invariants (e.g. the
section does not belong to the class, or the class does not offer the
subject being assigned).

## Authentication & health

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/health        # { status: "ok", db: "ok", ... }
```

## Phase 3 — Academic foundation

Permissions required are listed per route. `.view` permits reads;
`.manage` permits writes.

### Academic sessions

| Method & path | Permission |
|---|---|
| GET    /academic-sessions | `academic_sessions.view` |
| POST   /academic-sessions | `academic_sessions.manage` |
| GET    /academic-sessions/current | `academic_sessions.view` |
| GET    /academic-sessions/:id | `academic_sessions.view` |
| PUT    /academic-sessions/:id | `academic_sessions.manage` |
| DELETE /academic-sessions/:id | `academic_sessions.manage` (deactivate) |

Create/update body: `{ name, startDate?, endDate?, isCurrent? }`
(`YYYY-MM-DD`; `endDate` must be on/after `startDate`). Setting
`isCurrent: true` clears the flag on every other session.

### Terms

| Method & path | Permission |
|---|---|
| GET    /terms | `terms.view` (filter `?sessionId=`) |
| POST   /terms | `terms.manage` |
| GET    /terms/:id | `terms.view` |
| PUT    /terms/:id | `terms.manage` |
| DELETE /terms/:id | `terms.manage` (deactivate) |

Body: `{ sessionId, name, sequence, startDate?, endDate?, isCurrent? }`.
Only one term per session may be current.

### Classes

| Method & path | Permission |
|---|---|
| GET    /classes | `classes.view` |
| POST   /classes | `classes.manage` |
| GET    /classes/:id | `classes.view` (detail: sections + subjects) |
| PUT    /classes/:id | `classes.manage` |
| DELETE /classes/:id | `classes.manage` (deactivate) |

Body: `{ name, level?, sequence?, isActive? }`. `level` is free text,
never a hard-coded enum.

### Sections

| Method & path | Permission |
|---|---|
| GET    /sections | `sections.view` (filter `?classId=`) |
| POST   /sections | `sections.manage` |
| GET    /sections/:id | `sections.view` |
| PUT    /sections/:id | `sections.manage` |
| DELETE /sections/:id | `sections.manage` (deactivate) |

Body: `{ classId, name, capacity?, room?, isActive? }`.

### Subjects

| Method & path | Permission |
|---|---|
| GET    /subjects | `subjects.view` (`?search=`) |
| POST   /subjects | `subjects.manage` |
| GET    /subjects/:id | `subjects.view` |
| PUT    /subjects/:id | `subjects.manage` |
| DELETE /subjects/:id | `subjects.manage` (deactivate) |

Body: `{ name, code?, description?, isActive? }`.

### Class subjects (subjects offered by a class)

| Method & path | Permission |
|---|---|
| GET    /classes/:id/subjects | `classes.view` (bare array, joined) |
| POST   /classes/:id/subjects | `class_subjects.manage` |
| PUT    /classes/:id/subjects/:subjectId | `class_subjects.manage` |
| DELETE /classes/:id/subjects/:subjectId | `class_subjects.manage` |

POST body: `{ subjectId, isCompulsory?, maxScore? }`
(`isCompulsory` defaults to `true`). PUT accepts
`{ isCompulsory?, maxScore? }`; send `maxScore: null` to clear it.
Duplicate links return `409`.

### Teacher lookup and teacher subjects

| Method & path | Permission |
|---|---|
| GET    /teachers | `teachers.view` — active teachers `{ data }` lookup list |
| GET    /teacher-subjects?teacherId= | `teacher_assignments.manage` |
| POST   /teacher-subjects | `teacher_assignments.manage` |
| DELETE /teacher-subjects/:teacherId/:subjectId | `teacher_assignments.manage` |

POST body: `{ teacherId, subjectId }` (duplicates ignored/rejected).

### Teacher class assignments

| Method & path | Permission |
|---|---|
| GET    /teacher-assignments | `teacher_assignments.manage` (filters: `teacherId`, `classId`, `sectionId`, `subjectId`, `sessionId`) |
| POST   /teacher-assignments | `teacher_assignments.manage` |
| DELETE /teacher-assignments/:id | `teacher_assignments.manage` |

POST body:

```json
{
  "teacherId": "uuid",
  "classId": "uuid",
  "subjectId": "uuid",
  "sessionId": "uuid",
  "sectionId": "uuid (optional — whole class when omitted)",
  "isPrimaryTeacher": false
}
```

The server verifies that the teacher, class, session and subject
exist, that the section (if given) belongs to the class, and that the
class offers the subject. Duplicate assignments return `409`. GET
rows include denormalized `teacherName`, `className`, `sectionName`,
`subjectName` and `sessionName`.

## Phase 4 — People & enrollment

All endpoints live under `/api/v1`. Write actions are authorized,
audited, and return `403` without the matching permission. Soft-deleted
rows (`deletedAt`) are excluded from reads; deactivate/archive actions
set `deletedAt` rather than removing the row.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/students` | `students.view` | List students (search, status/class filters, paginated) |
| POST | `/students` | `students.create` | Create a student |
| GET | `/students/{id}` | `students.view` | Get one student |
| PUT | `/students/{id}` | `students.update` | Update a student |
| DELETE | `/students/{id}` | `students.update` | Archive a student (soft delete) |
| GET | `/students/{id}/parents` | `students.view` | List guardians linked to a student |
| POST | `/students/{id}/parents` | `parents.link_children` | Link a parent to a student |
| PUT | `/students/{id}/parents/{parentId}` | `parents.link_children` | Update a link (relationship/flags) |
| DELETE | `/students/{id}/parents/{parentId}` | `parents.link_children` | Unlink a parent |
| GET | `/students/{id}/enrollments` | `students.view` | List a student's enrollments |
| GET | `/parents` | `parents.view` | List parents (paginated) |
| POST | `/parents` | `parents.create` | Create a parent |
| GET | `/parents/{id}` | `parents.view` | Get one parent |
| PUT | `/parents/{id}` | `parents.update` | Update a parent |
| DELETE | `/parents/{id}` | `parents.update` | Deactivate a parent |
| GET | `/parents/{id}/children` | `parents.view` | List a parent's children |
| GET | `/teachers` | `teachers.view` | List teachers (paginated; replaces lookup list) |
| POST | `/teachers` | `teachers.create` | Create a teacher |
| GET | `/teachers/{id}` | `teachers.view` | Get one teacher |
| PUT | `/teachers/{id}` | `teachers.update` | Update a teacher |
| DELETE | `/teachers/{id}` | `teachers.update` | Deactivate a teacher |
| GET | `/staff` | `staff.view` | List non-teaching staff (paginated) |
| POST | `/staff` | `staff.create` | Create a staff profile |
| GET | `/staff/{id}` | `staff.view` | Get one staff profile |
| PUT | `/staff/{id}` | `staff.update` | Update a staff profile |
| DELETE | `/staff/{id}` | `staff.update` | Deactivate a staff profile |
| GET | `/enrollments` | `enrollments.view` | List enrollments (session/class/student filters) |
| POST | `/enrollments` | `enrollments.create` | Enroll a student in a class/session |
| GET | `/enrollments/{id}` | `enrollments.view` | Get one enrollment |
| PUT | `/enrollments/{id}` | `enrollments.update` | Update an enrollment |
| DELETE | `/enrollments/{id}` | `enrollments.update` | Remove an enrollment |

**Enrollment rules.** `createEnrollment` verifies the student, session,
class and (if given) term/section exist, that the term belongs to the
session and the section to the class. Duplicate placements for the same
`(student, session, term, class, section)` return `409`. `termId` and
`sectionId` are optional.

**Parent/student links.** `student_parents` uses a composite primary key
`(studentId, parentId)`; `POST` and `PUT` set `relationship`,
`isPrimary` and `isEmergencyContact`.

## Phase 5 — Timetable & attendance

All endpoints live under `/api/v1`. Write actions are authorized and
audited. Timetable slots are half-open: a slot ending at 10:00 does not
conflict with one starting at 10:00.

### Timetable (`/timetable`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/timetable` | `timetable.view` | List entries (filters: sessionId, termId, classId, sectionId, teacherId, weekday) |
| POST | `/timetable` | `timetable.manage` | Create an entry (conflict checked) |
| GET | `/timetable/{id}` | `timetable.view` | Get one entry |
| PUT | `/timetable/{id}` | `timetable.manage` | Update an entry (conflict re-checked) |
| DELETE | `/timetable/{id}` | `timetable.manage` | Remove an entry |

**Conflict rules (409).** Same weekday, session and overlapping time,
with term/section scope — a whole-session entry clashes with term-
specific entries and a whole-class entry with section-specific ones:

- teacher already teaching at that time;
- class already occupied (section scope aware);
- room already booked (case-insensitive room match).

Server also verifies session/term membership, section/class membership,
subject and teacher existence.

### Attendance (`/attendance`)

Registers are unique per session/term/class/section/date; one record per
student (upserted on `(attendanceSessionId, studentId)`). Workflow:
`open → submitted → approved`. Approved registers are locked and only
open registers can be deleted.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/attendance/sessions` | `attendance.view` | List registers (session/class/status/date range, paginated) |
| POST | `/attendance/sessions` | `attendance.mark` | Open a register (409 on duplicate) |
| GET | `/attendance/sessions/{id}` | `attendance.view` | Register header + records |
| PUT | `/attendance/sessions/{id}` | `attendance.update` | Update notes |
| DELETE | `/attendance/sessions/{id}` | `attendance.update` | Delete an open register |
| PUT | `/attendance/sessions/{id}/records` | `attendance.mark` | Bulk mark/upsert records (409 when register is approved) |
| POST | `/attendance/sessions/{id}/submit` | `attendance.update` | open → submitted |
| POST | `/attendance/sessions/{id}/approve` | `attendance.approve` | submitted → approved |
| GET | `/attendance/report` | `attendance.view` | Class report (requires sessionId + classId; optional termId/sectionId) |
| GET | `/attendance/students/{id}` | `attendance.view` | Student history + summary (requires sessionId) |

`PUT .../records` body: `{ records: [{ studentId, status, remark? }] }`
with status `present|absent|late|excused`; non-enrolled students are
rejected with 422. Reports return per-student totals and an attendance
rate of `(present + late) / total` rounded to 1 dp; whole-session/
whole-class registers count toward term/section reports.

## Phase 6 — Assignments, submissions & resources

All endpoints live under `/api/v1`. File bytes are stored privately in
Cloudflare R2 via the `R2_BUCKET` binding; PostgreSQL stores metadata and
object keys. Uploads are multipart/form-data with a single `file` part
(plus text fields). The server validates size (25 MB assignment/
submission, 50 MB resource), declared MIME against an allow-list
(PDF, images, text, Office, ZIP) and extension/MIME agreement, and
generates safe object keys — client filenames are never trusted. R2 is
required for file routes; without the binding they return `503` (use
`wrangler pages dev`, staging or production). Downloads stream through
the authorized API with `Content-Disposition`; objects are never public.

### Assignments (`/assignments`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/assignments` | `assignments.view` | List (session/term/class/section/subject/teacher/status). Staff see all; students only **published** assignments for classes they are actively enrolled in, each with `mySubmission` |
| POST | `/assignments` | `assignments.create` | Create (linked teacher account required; status defaults to draft) |
| GET | `/assignments/{id}` | `assignments.view` | Detail incl. `attachments` (student must be enrolled; draft → 404) |
| PUT | `/assignments/{id}` | `assignments.update` | Partial update; teachers only their own, admins any |
| DELETE | `/assignments/{id}` | `assignments.delete` | Deletes metadata and purges R2 attachment/submission objects |
| POST | `/assignments/{id}/attachments` | `assignments.update` | Multipart upload (201) |
| GET | `/assignments/{id}/attachments/{attachmentId}` | `assignments.view` | Download stream (published + enrolled for students) |
| DELETE | `/assignments/{id}/attachments/{attachmentId}` | `assignments.update` | Delete metadata + R2 object |
| GET | `/my/assignments` | `assignments.view` | Student board: published enrolled-class work + own submission |

Status is `draft|scheduled|published|archived`; publishing sets
`publishedAt`. Body fields: classId, optional sectionId/termId,
subjectId, sessionId, title, instructions?, maxScore? (1–100000),
dueDate? (ISO 8601), status?. Server verifies session/term and
section/class/subject references (422).

### Submissions

One submission per student per assignment (unique index). Status:
`draft → submitted|late → graded|returned`. Graded/returned work is
locked.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/assignments/{id}/submission` | `submissions.view` | The caller's own submission (or null) |
| PUT | `/assignments/{id}/submission` | `submissions.create` | Save work: JSON (`{textContent?, removeFile?}`) or multipart (`file`, optional `textContent`) |
| POST | `/assignments/{id}/submission/submit` | `submissions.create` | draft → `submitted`, or `late` when due date has passed |
| GET | `/assignments/{id}/submission/download` | `submissions.view` | Download own submitted file |
| GET | `/assignments/{id}/submissions` | `submissions.view` | Staff list with student names, optional status filter |
| GET | `/assignments/{id}/submissions/{studentId}/download` | `submissions.view` | Staff download of a student's file |
| POST | `/assignments/{id}/submissions/{studentId}/grade` | `submissions.grade` | `{score, feedback?, status?}`; score must be ≤ assignment maxScore (422) |

Students can only act on published assignments for classes (and
sections, when targeted) they are actively enrolled in. Replacing an
uploaded file deletes the previous R2 object.

### Learning resources (`/resources`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/resources` | `resources.view` | List (class/subject filters); students see only published, school-wide or enrolled-class items |
| POST | `/resources` | `resources.manage` | Multipart upload: `file` + title/description/classId/subjectId/isPublished (201) |
| GET | `/resources/{id}` | `resources.view` | Metadata (same visibility rules) |
| GET | `/resources/{id}/download` | `resources.view` | Authorized download stream |
| PUT | `/resources/{id}` | `resources.manage` | Update metadata/publish state (file cannot be replaced in place) |
| DELETE | `/resources/{id}` | `resources.manage` | Delete metadata + R2 object |

The `submissions.create` permission was added to the catalog and
granted to the student role. Mutations are audited
(`assignment.create`, `assignment.attachment.upload`,
`submission.save/submit/grade`, `resource.upload/update/delete`).

## Phase 7 — Exams, scores, results & report cards

All endpoints live under `/api/v1`. Scores and grade boundaries use
NUMERIC-backed strings transported as zod-validated strings to
preserve precision. Result workflow is a state machine:
`draft → submitted → approved → published`; once a publication leaves
`draft`, scores are locked and cannot be edited.

### Assessment types (`/assessment-types`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/assessment-types` | `exams.view` | List (paginated, optional `isActive`) |
| POST | `/assessment-types` | `exams.create` | Create (name, slug, weight?, description?, isActive?) |
| PUT | `/assessment-types/{id}` | `exams.update` | Partial update (at least one field) |

### Grading scales (`/grading-scales`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grading-scales` | `exams.view` | List with items (optional `sessionId`/`isActive`) |
| POST | `/grading-scales` | `exams.create` | Create with `items[]` (grade, minScore, maxScore, remark?, points?) |
| GET | `/grading-scales/{id}` | `exams.view` | Detail with items |
| PUT | `/grading-scales/{id}` | `exams.update` | Partial update; `items[]` replaces all rows in a transaction |

Each grade item must satisfy `minScore < maxScore`. Items array is
1–50 rows.

### Exams (`/exams`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/exams` | `exams.view` | List (session/term/class/status filters) |
| POST | `/exams` | `exams.create` | Create (sessionId, classId, name, optional termId/startDate/endDate/status) |
| GET | `/exams/{id}` | `exams.view` | Detail incl. `subjects[]` |
| PUT | `/exams/{id}` | `exams.update` | Partial update |
| POST | `/exams/{id}/open` | `exams.update` | Set status to `open` |
| POST | `/exams/{id}/close` | `exams.update` | Set status to `closed` |
| POST | `/exams/{examId}/subjects` | `exams.update` | Attach a subject with maxScore/examDate |
| PUT | `/exams/{examId}/subjects/{subjectId}` | `exams.update` | Update exam_subject maxScore/examDate |
| DELETE | `/exams/{examId}/subjects/{subjectId}` | `exams.update` | Detach subject (cascades to exam_scores) |
| PUT | `/exams/{examId}/scores` | `exam_results.enter` | Bulk upsert exam scores (1–200 rows); teachers only for assigned class/subject |

Status enum: `open | closed`. Teachers may only manage exams and
enter scores for classes/subjects they are assigned to in the session.

### Assessment scores (`/assessment-scores`)

Continuous assessment scores per student/subject/term/type.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/assessment-scores` | `exam_results.view` | List (student/subject/session/term/type filters); students see only their own |
| POST | `/assessment-scores` | `exam_results.enter` | Upsert (unique on student+subject+session+term+type) |
| PUT | `/assessment-scores/bulk` | `exam_results.enter` | Bulk upsert (1–200 rows) |

### Result publications (`/exam-results`)

Workflow: `draft → submitted → approved → published`. State-machine
guards block backwards transitions; once `submitted`, scores are
locked.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/exam-results` | `exam_results.view` | List (session/term/class/status) |
| POST | `/exam-results` | `exam_results.submit` | Get-or-create a `draft` publication for session/term/class/section |
| GET | `/exam-results/{id}` | `exam_results.view` | Detail |
| POST | `/exam-results/{id}/submit` | `exam_results.submit` | draft → submitted (locks scores) |
| POST | `/exam-results/{id}/approve` | `exam_results.approve` | submitted → approved |
| POST | `/exam-results/{id}/publish` | `exam_results.publish` | approved → published |

### Report cards & student results (`/students/{id}/…`, `/report-cards`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/students/{id}/results` | `exam_results.view` | Aggregated subject results + totals/grade (only when publication is `published` for students/parents) |
| GET | `/students/{id}/report-cards` | `report_cards.view` | List report cards (students only own; parents only own children's; non-staff only **published**) |
| POST | `/students/{id}/report-cards` | `report_cards.generate` | Compute and persist report card (idempotent on student+session+term) |
| POST | `/report-cards/{id}/publish` | `report_cards.publish` | Mark as `published` (sets `publishedAt`) |

### Self / parent context (`/my`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/my/school-context` | `exam_results.view` | Returns `{ studentId, children[] }` — resolves the current user's student profile (students) or children list (parents); staff get null fields |

Used by the `/results` page to drive self/child result lookups without
exposing other people's ids.

Mutations are audited (`assessment_type.create`, `grading_scale.update`,
`exam.create/open/close`, `exam_score.bulk_enter`,
`assessment_score.bulk_enter`, `result.submit/approve/publish`,
`report_card.generate/publish`).

## Phase 8 — Finance

All endpoints live under `/api/v1`. Money is PostgreSQL NUMERIC(12,2),
transported as strings with at most two decimal places; the server does
all arithmetic in integer cents (`app/shared/utils/money.ts`). Payments
are **manual** this phase — staff record and verify them; no payment
gateway or webhook is wired up (`providerReference` and
`idempotencyKey` columns are reserved). Receipts are JSON/metadata only
(no PDF; `objectKey` stays null) and are generated automatically when a
payment is verified.

Invoice workflow: `draft → issued → partially_paid → paid`; an invoice
may be `void`. Only `draft` invoices can be edited; an invoice with
payments cannot be voided. Overpayment is rejected.

### Fee structures (`/fee-structures`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/fee-structures` | `fees.view` | List structures with items (optional `sessionId`/`classId`/`isActive`); parents scoped to their children's classes |
| POST | `/fee-structures` | `fees.manage_structure` | Create with `items[]` (1–100) |
| GET | `/fee-structures/{id}` | `fees.view` | Detail with items |
| PUT | `/fee-structures/{id}` | `fees.manage_structure` | Partial update; sending `items[]` replaces all rows in a transaction |
| POST | `/fee-structures/{id}/items` | `fees.manage_structure` | Add one fee item |
| PUT | `/fee-structures/{id}/items/{itemId}` | `fees.manage_structure` | Update one fee item |
| DELETE | `/fee-structures/{id}/items/{itemId}` | `fees.manage_structure` | Remove one fee item |

Fee item: `name`, positive `amount`, optional `description`,
`isOptional`, `dueDate`.

### Invoices (`/invoices`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/invoices` | `invoices.view` | List (student/session/term/status filters); parents see only their children's non-draft invoices |
| POST | `/invoices` | `invoices.create` | Create from `feeStructureId` (+ optional `feeItemIds[]`) or manual `items[]`; starts as `draft` |
| GET | `/invoices/{id}` | `invoices.view` | Detail with `items[]` and `payments[]` |
| PUT | `/invoices/{id}` | `invoices.update` | Edit a draft (discount/tax/items recompute totals) |
| POST | `/invoices/{id}/issue` | `invoices.update` | draft → issued |
| POST | `/invoices/{id}/void` | `invoices.update` | Void (blocked once amount paid > 0) |

Create requires either `feeStructureId` or at least one manual item.
Invoice numbers are `INV-YYYY-NNNN`; totals are
`subtotal − discount + tax = total`.

### Payments (`/payments`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/payments` | `payments.view` | List (invoice/student/session/method/status); parents see only verified/refunded payments for their children |
| POST | `/payments` | `payments.record` | Record a payment (`invoiceId`, positive `amount`, method); `verifyImmediately` records-and-verifies when the caller has `payments.verify` |
| GET | `/payments/{id}` | `payments.view` | Payment detail with receipt |
| POST | `/payments/{id}/verify` | `payments.verify` | pending → verified; updates invoice totals and creates the receipt |
| POST | `/payments/{id}/refund` | `payments.refund` | verified → refunded; reverses amount paid and reopens the balance |
| GET | `/payments/{id}/receipt` | `receipts.view` | Receipt metadata |

Methods: `cash | bank_transfer | card | online_gateway | cheque |
other`. Payment numbers are `PAY-YYYY-NNNN`; receipts are
`RCT-YYYY-NNNN`.

### Reports (`/finance`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/finance/outstanding` | `invoices.view` | Outstanding invoices (balance > 0, issued/partially_paid); parents must pass their own `studentId` |
| GET | `/finance/outstanding?format=csv` | `finance.export` | Same data as a CSV download |
| GET | `/finance/summary` | `invoices.view` | Totals (invoiced/collected/outstanding/refunded), invoices by status, payments by method |

Mutations are audited (`fee_structure.create/update`,
`fee_structure.item_add/update/delete`, `invoice.create/update/issue/
void`, `payment.record/verify/refund`, `receipt.generate`).

## Phase 9 — Admissions

All endpoints live under `/api/v1/admissions` and are **staff only**
(admin / super_admin permissions). Applicants have no login accounts in
this phase; the public application form is deferred to the Phase 14
public website.

Workflow: `applied → documents_submitted → under_review →
assessment_scheduled → assessed → accepted → enrolled`. An application
may also be `waitlisted`, `rejected`, `admitted` or `withdrawn`. The
`documents_submitted`, `assessment_scheduled` and `assessed` states are
derived automatically when the first document is uploaded or when an
assessment gains a schedule / outcome. Terminal applications cannot be
edited. Application numbers are `APP-YYYY-NNNN`.

### Applications & decisions (`/admissions`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/admissions` | `admissions.view` | Paginated list (`page`, `perPage`, `search`, `sessionId`, `intendedClassId`, `status`) with document/assessment counts |
| POST | `/admissions` | `admissions.create` | Staff intake of an application; starts as `applied` |
| GET | `/admissions/{id}` | `admissions.view` | Detail with `documents[]` and `assessments[]` |
| PUT | `/admissions/{id}` | `admissions.update` | Edit an open application |
| POST | `/admissions/{id}/review` | `admissions.review` | Mark `under_review`; optional `notes` |
| POST | `/admissions/{id}/approve` | `admissions.approve` | → `accepted`; `decisionNotes` required |
| POST | `/admissions/{id}/reject` | `admissions.reject` | → `rejected`; `decisionNotes` required |
| POST | `/admissions/{id}/waitlist` | `admissions.review` | → `waitlisted`; optional `decisionNotes` |
| POST | `/admissions/{id}/withdraw` | `admissions.update` | → `withdrawn`; optional `decisionNotes` |
| POST | `/admissions/{id}/enroll` | `admissions.approve` | Accepted/waitlisted → enrolled student (201) |

Decisions can only be recorded from a non-terminal status. The enroll
conversion is one transaction: it creates the `students` row (staff
supplies the unique `admissionNumber`, status `enrolled`), an active
`student_enrollments` row (`sessionId`, `classId`, optional
`sectionId`/`termId`/`rollNumber`, required `enrollmentDate`), updates
the application to `enrolled` with `admittedStudentId`, and — when
`createGuardianParent` is true and guardian details exist — reuses or
creates a `parents` row linked via `student_parents`
(`relationship = guardian`). Response:
`{ application, student, enrollment, parent }`.

### Assessments / interviews

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/admissions/{id}/assessments` | `admissions.update` | Add (`title`, `assessmentType`: exam/interview/test/other, ISO `scheduledAt`, `score`, `result`: pass/fail/consider, `notes`); 201 |
| PUT | `/admissions/{id}/assessments/{assessmentId}` | `admissions.update` | Partial update |
| DELETE | `/admissions/{id}/assessments/{assessmentId}` | `admissions.update` | Remove |

### Documents (R2)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/admissions/{id}/documents` | `admissions.documents.manage` | `multipart/form-data`: file part `file` (≤ 10 MB; PDF, images, Office, text, ZIP) + text part `documentType`; 201 |
| GET | `/admissions/{id}/documents/{documentId}` | `admissions.documents.view` | Authorized streaming download from R2 |
| DELETE | `/admissions/{id}/documents/{documentId}` | `admissions.documents.manage` | Deletes metadata and the R2 object |

Bytes are stored in R2 under `admissions/documents/...` with metadata in
`admission_documents`; a failed metadata insert deletes the orphaned
object. In plain Node dev (`npm run dev`) without an R2 binding, upload
and download return 503 — use `npm run cf:dev` (Wrangler emulation) or
a deployed environment for file operations. Mutations are audited
(`admission.application.create/update/review/approve/reject/waitlist/
withdraw/enroll`, `admission.assessment.create/update/delete`,
`admission.document.upload/delete`).

## Phase 10 — Communication/events

All endpoints live under `/api/v1`. The whole phase is **staff only**
and RBAC-guarded by `requirePermission(event, '<slug>')`. Announcements
fan out notifications **synchronously on publish**: when an
announcement moves from `draft` to `published`, the server creates one
`notifications` row per recipient in the configured audience within the
same request. Gallery image bytes live in Cloudflare R2 via the
`R2_BUCKET` binding (metadata in PostgreSQL); under plain Node dev
(`npm run dev`) without the binding, gallery image upload and download
return `503` — use `npm run cf:dev` (Wrangler emulation) or a deployed
environment.

### Audience → role mapping

Announcement and event `audience` values expand to one or more role
slugs server-side. Clients never submit role lists.

| Audience | Roles |
|----------|-------|
| `everyone` | all authenticated users |
| `admins` | `super_admin`, `admin` |
| `staff` | `super_admin`, `admin` |
| `teachers` | `teacher` |
| `students` | `student` |
| `parents` | `parent` |

### Announcements (`/announcements`)

| Method | Path | Permission | Audit action | Notes |
|--------|------|------------|--------------|-------|
| GET | `/announcements` | `announcements.view` | — | List (audience/scope filters); recipients see only their audiences |
| POST | `/announcements` | `announcements.manage` | `announcement.create` | Create as `draft` |
| GET | `/announcements/{id}` | `announcements.view` | — | Detail with author and audience |
| PUT | `/announcements/{id}` | `announcements.manage` | `announcement.update` | Partial update (draft or published) |
| DELETE | `/announcements/{id}` | `announcements.manage` | `announcement.delete` | Remove metadata |
| POST | `/announcements/{id}/publish` | `announcements.publish` | `announcement.publish` | draft → published with synchronous notification fan-out to the audience |
| POST | `/announcements/{id}/archive` | `announcements.manage` | `announcement.archive` | published → archived |

### Notifications (`/notifications`)

Notifications are per-user; each row points back to its source
(announcement, message or event).

| Method | Path | Permission | Audit action | Notes |
|--------|------|------------|--------------|-------|
| GET | `/notifications` | `notifications.view` | — | List the current user's notifications (paginated, optional `unreadOnly`) |
| POST | `/notifications/read-all` | `notifications.mark_read` | `notification.mark_all_read` | Mark every unread notification as read |
| POST | `/notifications/{id}/read` | `notifications.mark_read` | `notification.mark_read` | Mark one as read |
| DELETE | `/notifications/{id}` | `notifications.delete` | `notification.delete` | Remove one notification |

### Messages (`/messages`)

| Method | Path | Permission | Audit action | Notes |
|--------|------|------------|--------------|-------|
| GET | `/messages` | `messages.view` | — | List conversations/threads for the current user |
| POST | `/messages` | `messages.send` | `message.send` | Body: `recipientId` (UUID) **or** `recipientEmail` (resolved server-side) plus `subject?` and `body` |
| GET | `/messages/{id}` | `messages.view` | — | Thread detail |
| POST | `/messages/{id}/read` | `messages.mark_read` | `message.mark_read` | Mark the thread as read |

### Events (`/events`)

| Method | Path | Permission | Audit action | Notes |
|--------|------|------------|--------------|-------|
| GET | `/events` | `events.view` | — | List (audience/scope filters) |
| POST | `/events` | `events.manage` | `event.create` | Create calendar event with `audience`, optional `startAt`/`endAt`, `location?`, `description?` |
| GET | `/events/{id}` | `events.view` | — | Detail |
| PUT | `/events/{id}` | `events.manage` | `event.update` | Partial update |
| DELETE | `/events/{id}` | `events.manage` | `event.delete` | Remove |

### Gallery (`/gallery/albums`)

| Method | Path | Permission | Audit action | Notes |
|--------|------|------------|--------------|-------|
| GET | `/gallery/albums` | `gallery.view` | — | List albums |
| POST | `/gallery/albums` | `gallery.manage` | `gallery.album.create` | Create album |
| GET | `/gallery/albums/{id}` | `gallery.view` | — | Album detail with images |
| PUT | `/gallery/albums/{id}` | `gallery.manage` | `gallery.album.update` | Update album metadata |
| DELETE | `/gallery/albums/{id}` | `gallery.manage` | `gallery.album.delete` | Remove album and its images |
| POST | `/gallery/albums/{id}/images` | `gallery.manage` | `gallery.image.upload` | `multipart/form-data`: file part `file` (≤ 25 MB, images only), 201 |
| GET | `/gallery/albums/{id}/images/{imageId}` | `gallery.view` | — | Authorized streaming download from R2 with `Content-Disposition` |
| DELETE | `/gallery/albums/{id}/images/{imageId}` | `gallery.manage` | `gallery.image.delete` | Removes metadata and the R2 object |

Gallery image upload and download return `503` under plain Node dev
(`npm run dev`) without the R2 binding — use `npm run cf:dev` (Wrangler
emulation) or a deployed environment. Message recipients can be
specified by `recipientId` (UUID) **or** `recipientEmail`; the server
resolves the email to a user account before persisting.

Mutations are audited (`announcement.create/update/delete/publish/
archive`, `notification.mark_read/mark_all_read/delete`,
`message.send/mark_read`, `event.create/update/delete`,
`gallery.album.create/update/delete`, `gallery.image.upload/delete`).

## Phase 11 — Reports/audit

All endpoints live under `/api/v1`. The phase is staff-only and
RBAC-guarded by `requirePermission(event, '<slug>')`. Reports
(`reports.view` to read, `reports.export` to receive CSV) and
audit logs (`audit_logs.view` to read, with CSV export gated by
`reports.export`). The student directory CSV export is gated by the
previously-dormant `students.export` slug. No new permissions or
migrations were added in Phase 11.

### Reports (`/reports`)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/reports/overview` | `reports.view` | School-wide counts (students total/active/archived, teachers/parents/staff, classes/sections/subjects, events upcoming/past) plus enrollments-by-status and announcements-by-status breakdowns; optional `sessionId`/`termId` filters |
| GET | `/reports/attendance` | `reports.view` | Per-class attendance totals (present/absent/late/excused, total, % rate); optional `sessionId`/`termId`/`classId`/`dateFrom`/`dateTo` filters; `?format=csv` requires `reports.export` |
| GET | `/reports/enrollments` | `reports.view` | Per-class-by-status enrollment counts; optional `sessionId`/`classId`/`status` filters; `?format=csv` requires `reports.export` |

CSV responses return `Content-Type: text/csv` with a `Content-Disposition:
attachment; filename="..."` header and a header row followed by data rows.
Cells containing `"`, `,` or newline are quoted/escaped per RFC 4180.

### Audit logs (`/audit-logs`)

Audit log reads are super_admin-only. The seeder inserts rows directly
via Drizzle (not through API routes), so a fresh dev DB has audit rows
only after seeding; real audit rows accumulate through normal mutation
routes.

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/audit-logs` | `audit_logs.view` | Paginated list (LEFT JOIN users for userName/userEmail); filters: `action` (text), `resource` (curated enum), `userId` (UUID), `dateFrom`/`dateTo` (timestamp), `search` (ilike description/action), `order` (`asc` = oldest first, `desc` = newest first); `?format=csv` requires `reports.export` |

### Student directory CSV (`/students`)

The existing `GET /students` list endpoint was extended with an
optional `?format=csv` branch that emits a flat directory CSV (admission
no, first/last name, status, class, guardian name/email/phone). Capped
at 5000 rows. JSON behaviour is unchanged.

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/students?format=csv` | `students.export` | CSV directory export (no JSON pagination envelope) |

### Frontend integration

Phase 11 client wiring lives in `app/services/reports.ts`
(`reportsApi` for overview/attendance/enrollments, `auditLogsApi`
for list, `downloadCsv(path, fileName, params)` helper using native
`fetch` with `credentials:'include'` and a Blob URL for programmatic
download). `app/pages/reports/index.vue` and
`app/pages/audit-logs/index.vue` consume the service. The dashboard
`app/pages/index.vue` adds Reports and Audit logs sections (gated by
`reports.view` and `audit_logs.view` respectively).

## Frontend integration

The Nuxt app calls all APIs through `app/services/api.ts` (an ofetch
wrapper that attaches the CSRF header) and typed domain wrappers such as
`app/services/academics.ts`, `finance.ts`, `admissions.ts`,
`communications.ts` and `events.ts`. Pages and components never call
`$fetch` directly for domain data. Admissions document downloads use
same-origin authenticated links built by `admissionsApi.documentUrl(...)`.

## Auditing

All Phase 3 mutations write an audit record (`writeAudit`) with
actions such as `academic_session.create`, `term.update`,
`class_subject.add` and `teacher_assignment.create`, attributed to
the authenticated user.

## Phase 12 — Hardening (Part A)

Part A closes two security/authorization gaps flagged as "deferred to
Phase 12" in earlier phases. No new routes, permissions or migrations
are introduced; existing endpoints gain an additive validation/scoping
layer.

### File-upload magic-byte content sniffing

`readUpload` (in `server/utils/multipart.ts`) now sniffs the leading
512 bytes of every uploaded file and rejects mismatches with the
declared MIME. This applies to all five upload routes: assignment
attachments, submissions, gallery images, learning resources and
admission documents.

- `sniffMagicBytes(bytes)` (`server/utils/uploads.ts`) returns a
  canonical MIME family for strong signatures: `application/pdf`,
  `image/png`, `image/jpeg`, `image/gif`, `image/webp`,
  `image/svg+xml`, `application/zip` (covers OOXML `.docx/.xlsx/.pptx`
  containers), `application/x-cfb` (legacy Office OLE),
  `application/x-msdownload` (MZ DOS/PE executables),
  `application/x-elf`, or `text/plain` (printable-ASCII heuristic). It
  returns `null` for unknown content.
- `assertSniffMatchesDeclared(sniffed, declaredMime)` throws
  `422 File content does not match the declared type.` when the sniffed
  family is incompatible with the declared MIME. Compatible = sniff is
  `null`; equals the declared MIME; is the ZIP container for a declared
  `application/vnd.openxmlformats-officedocument.*`; is the OLE
  compound for a declared legacy `application/msword` /
  `application/vnd.ms-excel` / `application/vnd.ms-powerpoint`; is
  `text/plain` for any `text/*`; or is `image/svg+xml` for a declared
  `image/svg+xml`. Everything else (e.g. an EXE sniffed under a
  declared `application/pdf`) is rejected.
- The existing declared-MIME + extension cross-check
  (`validateUpload`) is unchanged; the sniff is an additive
  defense-in-depth layer. Anti-malware scanning (a ClamAV/AV gateway)
  remains deferred.

### Row-level scoping (timetable, attendance, exams)

List endpoints were previously permission-gated but not scoped to the
caller's business identity, so a teacher could read the whole school's
timetable/attendance/exams and a student/parent could read other
people's records. They are now scoped via `resolveActorProfile(event,
staffPermission)` (`server/utils/auth/actor.ts`), cached per request.

| Endpoint | Staff marker | Teacher scope | Student scope | Parent scope |
| --- | --- | --- | --- | --- |
| `GET /api/v1/timetable` | `timetable.manage` | own entries (`teacherId = self`; a passed foreign `teacherId` is silently ignored) | classes they're actively enrolled in | children's enrolled classes |
| `GET /api/v1/attendance/sessions` | `attendance.approve` | classes they teach that session | their enrolled classes | children's classes |
| `GET /api/v1/attendance/report` | `attendance.approve` | must teach the requested class else `403` | must be enrolled else `403` | a child must be enrolled else `403` |
| `GET /api/v1/attendance/students/:id` | `attendance.approve` | student must be in a class they teach else `403` | only self (other id → `403`) | only own children else `403` |
| `GET /api/v1/exams` | `exams.create` | exams for classes they teach | their enrolled classes' exams | children's classes' exams |

Staff = admins (super_admin/admin roles) OR callers holding the staff
marker permission. Staff bypass row-level scoping and see everything;
their explicit query filters still apply. Exam score entry, result
publications and report-card paths were already scoped in Phase 7 and
are unchanged. Assignment/exam *create/update* flows keep their own
`getActor` (auth-based) resolution; only the shared list/read scoping
above is new.

### Tests

- `server/utils/__tests__/uploads.test.ts`: 18 new cases covering each
  recognised signature, the text/SVG heuristics, and the
  pass/reject matrix of `assertSniffMatchesDeclared`.
- `server/services/__tests__/schedule-scope.test.ts`: 8 cases for the
  pure `classifyActorScope` decision branches (staff / teacher /
  student / parent / none, and precedence rules).

## Phase 12 — Hardening (Part B)

Part B moves announcement notification fan-out off the publish request
and onto Cloudflare Queues, consumed inside the same Worker.

### Flow

1. `POST /api/v1/announcements/:id/publish` marks the announcement
   `published`, counts the audience recipients, and enqueues ONE message
   on the `NOTIFICATION_QUEUE` producer binding. The response keeps its
   `{ announcement, notified }` shape; `notified` is the targeted
   recipient count computed before fan-out.
2. Cloudflare delivers the batch to the Worker's `queue()` handler.
   Nitro's `cloudflare-module` runtime already exports that handler and
   re-emits the batch as the `cloudflare:queue` Nitro hook; the consumer
   is `server/plugins/cloudflare-queue.ts` (no custom Worker entry).
3. The consumer opens a short-lived Hyperdrive-backed client via
   `createWorkerDatabase()` (`server/utils/db.ts`), dispatches each
   message through `dispatchMessage()`
   (`server/services/notification-dispatch.ts`), and `ack()`s on
   success. A transient error calls `message.retry()` (redelivery with
   backoff); a malformed envelope (zod `ZodError`) is a poison message
   and is `ack()`ed so it cannot block the queue. The client is closed
   when the batch settles.

In plain Node dev (`nuxt dev`) there is no queue binding;
`publishAnnouncement` calls `dispatchAnnouncement` inline so
notifications are still created synchronously.

### Message contract

```json
{ "kind": "announcement.published", "announcementId": "<uuid>" }
```

Validated by `announcementPublishedMessageSchema` (zod). The consumer
re-reads the announcement from the id (audience/title/body are not
duplicated in the message). Only `announcement.published` exists today;
unknown kinds fail validation.

### Idempotency (at-least-once delivery)

Migration `0002_bright_betty_brant.sql` adds nullable
`notifications.announcement_id` plus a partial unique index
`notifications_user_announcement_idx ON (user_id, announcement_id)
WHERE announcement_id IS NOT NULL`. The consumer's INSERT ends with
`ON CONFLICT (user_id, announcement_id) WHERE announcement_id IS NOT
NULL DO NOTHING`, so a redelivered message (crash mid-batch, retry)
never creates duplicate rows. A no-op redelivery after the
announcement leaves `published` returns 0. Verified against local
PostgreSQL: first delivery inserted the recipient rows; an immediate
redelivery inserted 0.

### wrangler.toml

`[[queues.consumers]]` is declared for local (`sms-notifications-local`),
`env.staging` and `env.production` (`max_batch_size = 10`,
`max_batch_timeout = 5`), alongside the existing producers. Provision
per environment once: `wrangler queues create sms-notifications-staging`
/ `-production`. `wrangler deploy --dry-run` confirms the binding.

### Files

`database/schema/communication.ts` + migration 0002;
`server/services/notification-dispatch.ts` (envelope, audience SQL,
recipient count, idempotent fan-out, router);
`server/utils/notifications-queue.ts` (binding accessor + producer);
`server/utils/db.ts` (`createWorkerDatabase`);
`server/plugins/cloudflare-queue.ts` (consumer hook);
`server/services/communication.ts` (`publishAnnouncement` enqueues,
inline fallback); publish route passes the binding.

### Tests

`server/services/__tests__/notification-dispatch.test.ts` (17 cases):
envelope validation (object/JSON string, unknown kind, malformed/non-uuid
id, garbage), audience fragment parameter binding, recipient-count
coercion, idempotent INSERT SQL, stale/missing announcement behaviour,
and router branch selection against a mock Drizzle client.

## Phase 12 — Hardening (Part C / Option A)

Option A renders a PDF on report-card generate/publish, stores it in
R2, and adds an authorized download endpoint. No new migration, table
column, or permission — the existing `report_cards.object_key` column
and `report_cards.view` permission are reused. Options B
(Excel/.xlsx exports) and C (gallery image thumbnails) remain deferred.

### Flow

1. `POST /api/v1/students/:id/report-cards` runs
   `generateReportCard` (unchanged), then calls
   `storeReportCardPdf(event, card)` which renders the PDF via
   `renderReportCardPdf(card)`, writes it to the `R2_BUCKET` binding
   via `putObject` under a stable key
   (`report-cards/<sessionId>/<termId>/<studentId>/<cardId>.pdf`),
   and persists the key on the row via `setReportCardObjectKey`. The
   response re-fetches the card so `objectKey` reflects what was
   stored.
2. `POST /api/v1/report-cards/:id/publish` runs `publishReportCard`
   (unchanged), then calls `storeReportCardPdf` again so the stored
   PDF reflects the published status and any updated remarks. The same
   stable key is reused (R2 puts overwrite).
3. `GET /api/v1/report-cards/:id/pdf` authorises via
   `requirePermission('report_cards.view')`, resolves the actor with
   `getActor`, and calls `getReportCard(id, actor)` — which enforces
   own/children + published-only access for non-staff callers (404
   when missing, 403 when forbidden). When `objectKey` is null it
   returns 404 ("Report card PDF has not been generated."). Otherwise
   it streams the object from R2 via `streamObject` with
   `Content-Type: application/pdf` and a
   `Content-Disposition: attachment; filename=report-card-<admissionNumber>.pdf`
   header.

### Plain Node dev

`putObject` throws 503 when the `R2_BUCKET` binding is absent
(`nuxt dev`). `storeReportCardPdf` swallows that specific 503 and
leaves `objectKey` null — generation/publish still succeed and return
the card; the download endpoint then returns 404. Use `npm run cf:dev`
or staging/prod to actually store and serve PDFs.

### Files

`server/utils/pdf/report-card.ts` (pure `renderReportCardPdf`,
`buildReportCardObjectKey`, `storeReportCardPdf` R2 orchestrator);
`server/services/exams.ts` (`setReportCardObjectKey`);
`server/api/v1/students/[id]/report-cards.post.ts` +
`server/api/v1/report-cards/[id]/publish.post.ts` (wired);
`server/api/v1/report-cards/[id]/pdf.get.ts` (download);
`server/utils/storage.ts` (`putObject` widened to
`ArrayBuffer | ArrayBufferView` so a `Uint8Array` can be passed
directly).

### Tests

`server/utils/pdf/__tests__/report-card.test.ts` (15 cases): object-key
build/stability/character stripping; PDF magic header; single page for
an empty card; header/student-block/totals/remarks rendering; empty
subject state; subject table with scores + score breakdown; several
table-only subjects on one page; pagination for 30 subjects; null
optional fields; omission of absent sections; long-name truncation; and
long-remark wrapping. Text assertions inflate pdf-lib's
FlateDecode-compressed streams and decode the `<hex> Tj` text operands
(standard Helvetica fonts) — no extra text-extraction dependency.

### Known limitations

- Standard Latin fonts (Helvetica) only; non-Latin student names may
  not render correctly. Unicode font embedding (bundling a TTF and
  `embedFont`) is deferred.
- PDF storage requires the `R2_BUCKET` binding; plain `npm run dev`
  cannot store or serve PDFs. Use `npm run cf:dev` or staging/prod.
- The PDF is regenerated only on generate/publish — editing a
  published card's remarks without re-publishing leaves a stale PDF
  (matches the publish-gated access model).

## Phase 12 — Hardening (Part C / Option B)

### xlsx exports

Every existing CSV report endpoint now accepts
`?format=json|csv|xlsx` (unknown values return `422` instead of
silently falling back to JSON):

| Endpoint | Permissions (non-json) |
|---|---|
| `GET /api/v1/reports/attendance` | `reports.view` + `reports.export` |
| `GET /api/v1/reports/enrollments` | `reports.view` + `reports.export` |
| `GET /api/v1/reports/admissions` | `admissions.view` + `reports.export` |
| `GET /api/v1/audit-logs` | `audit_logs.view` + `reports.export` |
| `GET /api/v1/students` | `students.view` + `students.export` |
| `GET /api/v1/finance/outstanding` | `invoices.view` + `finance.export` |

xlsx workbooks are generated edge-side by `write-excel-file`
(universal build — no Node/`fs`/Web Worker dependencies; fflate is
bundled inline) and sent as
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
The header row is bold; money/score values remain **text cells** so
NUMERIC precision is never lossy-converted in Excel.

Exam score sheets (xlsx only — no csv):

- `GET /api/v1/exams/:id?format=xlsx` — requires `exams.view` plus
  `reports.export`. Columns: admission number, student name, subject
  code, subject name, max score, score, grade; ordered by admission
  number then subject name. `json`/no format returns the normal exam
  document; any other format value is a `422`.

### Admissions pipeline report

- `GET /api/v1/reports/admissions` — `admissions.view`
  (`reports.export` for csv/xlsx). Optional `sessionId`,
  `intendedClassId`. Returns one row per pipeline stage in workflow
  order (`applied → documents_submitted → under_review →
  assessment_scheduled → assessed → accepted → rejected →
  waitlisted → admitted → enrolled → withdrawn`) with a zero-filled
  count, plus a `total`. The xlsx/csv render appends a `Total` row.

### Audit certificate

- `GET /api/v1/reports/audit-certificate` — requires both
  `audit_logs.view` and `reports.export`; streams an A4 PDF
  (`application/pdf`, inline). Optional filters: `action`,
  `resource`, `userId`, `dateFrom`, `dateTo` (same date semantics as
  the audit-log list). The certificate contains the generation
  timestamp and requesting actor, the exact scope/filter window, the
  total/earliest/latest record counts, a per-action breakdown table
  (paginated), an append-only statement, and a point-in-time
  reference string. It is rendered on demand from live aggregates and
  is **not** persisted to R2.

## Phase 12 — Hardening (Part C / Option C)

### Gallery thumbnails

- `GET /api/v1/gallery/albums/:id/images/:imageId/thumbnail` —
  requires `gallery.view` (the same permission as the full image).
  Streams a derived JPEG thumbnail (`image/jpeg`, disposition
  `inline`, `Cache-Control: private, max-age=31536000, immutable`).

Behavior:

- Thumbnails are generated on-Worker with WASM codecs
  (`@jsquash` mozjpeg/PNG/libwebp/resize). Raster JPEG, PNG and WebP
  sources wider than 480 px are downscaled (lanczos3, quality 82) and
  re-encoded as JPEG. Images at or below the cap are never upscaled.
  GIF and SVG are intentionally not thumbnailed.
- **Eager generation at upload**: when a supported image is posted to
  `POST /api/v1/gallery/albums/:id/images`, the thumbnail is produced
  best-effort and stored in R2 alongside the original at a
  deterministic key (`<object-key>.thumb.jpg`, recorded in
  `thumb_object_key`). Any failure is swallowed; the upload still
  succeeds.
- **Lazy backfill on GET**: rows with a null `thumb_object_key`
  (legacy rows or eager-generation failures) are backfilled on the
  first authorized thumbnail request.
- **404 fallback**: when no thumbnail can exist (GIF/SVG), the source
  bytes are missing, or processing fails, the endpoint returns `404`
  with `{ "error": "No thumbnail is available for this image." }`; the
  gallery UI then loads the original image URL. A stored key whose R2
  object is missing triggers one regeneration attempt before 404.
- The original R2 object remains the source of truth; the thumbnail is
  an immutable, regenerable cache and is deleted together with its
  image (and with album deletion).
- Generation adds WASM CPU time to uploads of supported images; source
  dimensions are capped at 10,000 px to bound memory use.

