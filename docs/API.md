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

## Frontend integration

The Nuxt app calls all APIs through `app/services/api.ts` (an ofetch
wrapper that attaches the CSRF header) and typed domain wrappers in
`app/services/academics.ts`. Pages and components never call
`$fetch` directly for domain data.

## Auditing

All Phase 3 mutations write an audit record (`writeAudit`) with
actions such as `academic_session.create`, `term.update`,
`class_subject.add` and `teacher_assignment.create`, attributed to the
authenticated user.
