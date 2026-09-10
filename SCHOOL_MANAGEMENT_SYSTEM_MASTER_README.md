# TRAE CN MASTER DEVELOPMENT README

## Victorious Children School --- School Management System (SMS)

### Vue 3 + TypeScript + Vite + Laravel 12 API + PostgreSQL + Redis + Cloudflare R2

> **MASTER SOURCE OF TRUTH.** Build the authenticated SMS first. Build
> the public school website later.

## 1. Final architecture

This project uses the following approved stack:

-   Frontend: Vue 3, TypeScript, Vite, Vue Router, Pinia, Tailwind CSS.
-   Backend: Laravel 12, PHP 8.4+, REST API, Laravel Sanctum, Eloquent.
-   Database: PostgreSQL.
-   Cache/queues: Redis.
-   Files: Cloudflare R2 through S3-compatible storage.
-   Edge/security: Cloudflare DNS, TLS, WAF, rate limiting where
    appropriate.
-   Source control: Git + GitHub.
-   AI IDE: TRAE CN.
-   Testing: Vitest, Laravel/Pest or PHPUnit, Playwright for critical
    E2E.
-   Production: Linux VPS or managed Laravel/PHP server behind
    Cloudflare.

Architecture:

``` text
Cloudflare
   |
   v
Vue 3 + TypeScript + Vite
   | HTTPS/JSON
   v
Laravel 12 API + Sanctum + RBAC
   |
   +---- PostgreSQL (source of truth)
   +---- Redis (cache/queues)
   +---- Cloudflare R2 (objects/files)
```

Do not introduce React/Next.js, D1, another primary database, or a
second backend framework without explicit approval.

## 2. Product boundary

Build a production-ready multi-role School Management System for
nursery, primary, JSS and SS operations. The first release must not
depend on a public marketing website.

Initial roles:

1.  Super Admin
2.  Admin
3.  Teacher
4.  Student
5.  Parent

Future roles may include Accountant, Principal, Vice Principal, Exam
Officer, Receptionist, Librarian, Transport Officer and other staff.

The system must preserve historical academic and financial records
across sessions and terms.

## 3. Core modules

-   Authentication and account security
-   RBAC and permissions
-   School settings
-   Academic sessions and terms
-   Classes and sections
-   Subjects and class subjects
-   Teacher assignments
-   Students
-   Parents/guardians
-   Teachers/staff
-   Enrollments
-   Timetable
-   Attendance
-   Assignments and submissions
-   Learning resources
-   Exams and assessments
-   Scores/results
-   Configurable grading
-   Result approval/publication
-   Report cards
-   Fees, invoices, payments and receipts
-   Admissions
-   Documents
-   Announcements
-   Notifications
-   Messaging
-   Events
-   Gallery
-   Reports/exports
-   Audit logs
-   R2 file management

## 4. Non-goals for initial build

Do not begin with:

-   public marketing homepage
-   public CMS website
-   public SEO pages
-   public gallery/events website
-   public admissions marketing pages

Later structure may be:

``` text
www.school-domain.com       -> public website
portal.school-domain.com    -> authenticated SMS
api.school-domain.com       -> versioned API/integrations
```

The exact domain must be supplied by the project owner; never invent
one.

## 5. TRAE operating rules

Before every change TRAE must:

1.  Read `README.md` and `PROJECT_RULES.md`.
2.  Inspect the repository and existing implementation.
3.  Identify the current phase.
4.  Make a small implementation plan.
5.  Implement only the approved phase/task.
6.  Add/update tests.
7.  Run relevant checks.
8.  Update documentation.
9.  Report files, migrations, endpoints, tests and known limitations.

TRAE must never:

-   invent requirements;
-   overwrite unrelated work;
-   rewrite the project unnecessarily;
-   bypass authorization;
-   hard-code school policies, fees or grading rules;
-   hard-code secrets;
-   commit `.env` or credentials;
-   use real student data in fixtures/staging;
-   expose private files publicly;
-   trust client-supplied roles, permissions or payment status;
-   delete historical academic records merely because a student leaves;
-   introduce duplicate models/routes/migrations;
-   build the public website before the SMS foundation is stable.

## 6. Project rules file

Create `PROJECT_RULES.md` at repository root. It must include:

``` text
Mission: production-ready School Management System.
Frontend: Vue 3 + TypeScript + Vite.
Backend: Laravel 12 API.
Database: PostgreSQL.
Cache/queues: Redis.
Storage: Cloudflare R2.

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript.
Use reusable components.
Use Form Requests for non-trivial validation.
Use Policies/Gates for authorization.
Use Services/Actions for multi-step domain workflows.
Use database transactions for multi-write operations.
Use PostgreSQL as the source of truth.
Use R2 for objects, PostgreSQL for file metadata.
Keep controllers thin.
Never hard-code secrets or school policy.
Never trust client authorization claims.
Preserve historical records.
Add tests for critical behavior and authorization boundaries.
Run tests, type checks, lint and build before completing a phase.
Document architectural deviations.
```

## 7. Roles and access boundaries

### Super Admin

System-level operator; roles/permissions, school/system settings,
integrations, storage, audit logs and high-level administration.

### Admin

Broad school operations according to explicit permissions: people,
academics, admissions, attendance, results, finance, timetable,
communications, reports and settings.

### Teacher

Own profile, assigned classes/subjects, timetable, permitted attendance,
assignments, resources, grading and result entry/submission. No finance
access unless explicitly granted.

### Student

Own profile, enrollment, timetable, attendance, assignments,
submissions, published results/report cards, announcements and permitted
resources. No access to other students.

### Parent

Own account and only linked children. Can view child academics,
attendance, timetable, published results, report cards, fees, invoices,
payments, receipts, announcements and permitted communications.

Parent-child access must always be enforced server-side through the
authenticated parent's links.

## 8. Permission model

Use explicit permissions rather than scattered role-name checks. At
minimum support:

``` text
dashboard.view
school.settings.view / school.settings.update
users.view / users.create / users.update / users.delete
roles.view / roles.manage
students.view / students.create / students.update / students.delete / students.archive / students.export
parents.view / parents.create / parents.update / parents.link_children
teachers.view / teachers.create / teachers.update / teachers.delete
academic_sessions.view / academic_sessions.manage
terms.view / terms.manage
classes.view / classes.manage
sections.view / sections.manage
subjects.view / subjects.manage
class_subjects.manage
teacher_assignments.manage
enrollments.view / enrollments.create / enrollments.update
attendance.view / attendance.mark / attendance.update / attendance.approve / attendance.export
assignments.view / assignments.create / assignments.update / assignments.delete
submissions.view / submissions.grade
resources.view / resources.manage
exams.view / exams.create / exams.update
exam_results.view / exam_results.enter / exam_results.update / exam_results.submit / exam_results.approve / exam_results.publish
report_cards.view / report_cards.generate / report_cards.publish
fees.view / fees.manage_structure
invoices.view / invoices.create / invoices.update
payments.view / payments.record / payments.verify / payments.refund
receipts.view / receipts.generate
finance.export
admissions.view / admissions.create / admissions.update / admissions.review / admissions.approve / admissions.reject
admissions.documents.view / admissions.documents.manage
timetable.view / timetable.manage
announcements.view / announcements.create / announcements.update / announcements.publish
notifications.view
messages.view / messages.send
reports.view / reports.export
audit_logs.view
```

## 9. UI/UX direction

The portal must feel like a modern SaaS product, with a refined
Apple-inspired level of simplicity and polish without copying
proprietary designs.

Desktop shell:

``` text
+----------------------------------------------------------------+
| School | Session | Search | Notifications | Profile            |
+-------------+--------------------------------------------------+
| Sidebar     | Page title / actions                           |
| Dashboard   | KPI cards / filters / tables / charts             |
| Students    |                                                  |
| Academics   | Main content                                     |
| Attendance  |                                                  |
| Finance     |                                                  |
| Reports     |                                                  |
| Settings    |                                                  |
+-------------+--------------------------------------------------+
```

Mobile requirements:

-   collapsible navigation
-   responsive tables/card fallback
-   no horizontal overflow
-   touch-friendly controls
-   accessible forms
-   clear loading, empty, error and success states
-   confirmations for destructive actions
-   restrained animation

Use reusable Vue components rather than page-specific duplication.

## 10. Frontend structure

``` text
frontend/
├── src/
│   ├── components/{ui,forms,tables,charts,navigation,feedback}
│   ├── composables/
│   ├── layouts/
│   ├── pages/{auth,admin,teacher,student,parent}
│   ├── router/
│   ├── stores/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── main.ts
├── tests/
└── ...
```

Use a centralized API client; do not scatter raw HTTP calls throughout
components. Use Pinia for genuinely shared state, not every API
response.

## 11. Backend structure

``` text
backend/
├── app/
│   ├── Actions/
│   ├── Enums/
│   ├── Http/{Controllers/Api,Requests,Resources}
│   ├── Models/
│   ├── Policies/
│   ├── Services/
│   ├── Jobs/
│   ├── Notifications/
│   └── ...
├── database/{factories,migrations,seeders}
├── routes/{api.php,web.php}
└── tests/{Feature,Unit}
```

Keep controllers thin. Use Eloquent relationships, API Resources, Form
Requests, Policies and transactions.

## 12. Database model

Primary tables:

``` text
users
roles
permissions
role_permissions
user_roles
school_settings

students
parents
teachers
staff_profiles
student_parents

academic_sessions
terms
classes
sections
subjects
class_subjects
teacher_subjects
teacher_class_assignments
student_enrollments

timetable_entries

attendance_sessions
attendance_records

assignments
assignment_attachments
assignment_submissions

assessment_types
exams
exam_subjects
assessment_scores
exam_scores
grading_scales
grading_scale_items
result_publications
report_cards

fee_structures
fee_items
student_invoices
invoice_items
payments
payment_receipts

admission_applications
admission_documents
admission_assessments

announcements
notifications
messages

events
gallery_albums
gallery_images

audit_logs
```

Rules:

-   PostgreSQL is the source of truth.
-   Use foreign keys and meaningful unique constraints.
-   Index real query paths.
-   Use exact decimal types for money.
-   Preserve timestamps and academic history.
-   Use transactions for financial/result workflows.
-   Use soft deletion only where domain-appropriate.
-   Never use floating point for monetary calculations.

## 13. Academic model

Sessions contain terms, for example:

``` text
2026/2027
├── First Term
├── Second Term
└── Third Term
```

Support Crèche/Nursery/Primary/JSS/SS and sections such as A/B/C without
hard-coding them.

Enrollment must track student, session, optional term, class, section,
enrollment date, status and roll number.

Never infer historical enrollment from the student's current class
alone.

## 14. Student lifecycle

``` text
Applicant -> Admitted -> Enrolled -> Active -> Graduated/Transferred/Withdrawn/Archived
```

Leaving school must not destroy historical records.

## 15. Attendance

Statuses:

``` text
present
absent
late
excused
```

Support daily marking, editing with permission, reports, student/class
percentages, session/term history and configurable parent notifications.
Prevent duplicate records for the same student and attendance context.

## 16. Timetable

Entries contain session, term, class, section, subject, teacher, room,
weekday, start and end times.

Prevent obvious conflicts:

-   teacher in two classes at once
-   class in two subjects at once
-   room used twice at once

## 17. Assignments/resources

Assignments contain teacher, class/section, subject, title,
instructions, due date, maximum score, attachments, publish date and
status.

Submissions contain student, assignment, text/file, submitted time,
score, feedback, grader and grading time.

Resources may include PDFs, slides, handouts and images. Store objects
in R2 and metadata in PostgreSQL.

## 18. Exams/results/grading

Support configurable assessment types such as CA/test, assignment,
midterm, examination, practical and project.

Result workflow:

``` text
Draft -> Submitted -> Approved -> Published
```

Only published results are visible to students/parents unless an
explicitly authorized preview exists.

Grades must be configurable. Example only:

``` text
70-100 A
60-69  B
50-59  C
45-49  D
40-44  E
0-39   F
```

Do not hard-code ranges in controllers or Vue components.

Report cards must support student/session/term/class, subject results,
totals, average, grade, remarks, attendance, teacher/principal remarks
and signature placeholders. Support generate, preview, publish, PDF and
print.

## 19. Finance

Model:

``` text
Fee Structure -> Invoice -> Invoice Items -> Payment -> Verification -> Receipt
```

Support fee structures/items, discounts if approved, invoices, payments,
verification, receipts, balances and reports.

Money must use exact numeric types.

Payment integrations, when added, must use verified webhooks,
idempotency, provider references and secure secrets. Never trust browser
payment success alone.

## 20. Admissions

Workflow:

``` text
Application -> Documents -> Review -> Assessment/Interview -> Decision -> Admission -> Enrollment
```

Support application status, documents, assessments, notes and decisions.

## 21. Communication

Support announcements, notifications and controlled messaging.
Announcements should support draft/scheduled/published/archived states
and audience targeting.

Bulk notifications/emails must use queues.

## 22. Events/gallery

Events contain title, description, date/time, location, audience and
status.

Gallery uses albums and images. Images belong in R2;
thumbnails/optimization may be asynchronous.

## 23. R2 storage

Use separate buckets/environments, for example:

``` text
sms-staging
sms-production
```

Object prefixes may include:

``` text
students/photos/
admissions/documents/
assignments/attachments/
assignments/submissions/
resources/
report-cards/
receipts/
events/
gallery/
exports/
```

PostgreSQL stores object metadata. R2 stores the object. Private objects
must remain private and be served through authorized backend access or
temporary/presigned URLs.

Validate uploads server-side by type, MIME, size, category and
authorization. Generate safe object keys. Never trust filenames or
client MIME declarations.

## 24. API

Use `/api/v1` and consistent JSON responses.

Authentication:

``` text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

Core resources:

``` text
GET/POST        /api/v1/students
GET/PUT/DELETE  /api/v1/students/{student}
POST            /api/v1/students/{student}/archive

GET/POST        /api/v1/parents
GET/PUT         /api/v1/parents/{parent}
POST            /api/v1/parents/{parent}/children

GET/POST        /api/v1/teachers
GET/PUT         /api/v1/teachers/{teacher}

GET/POST/PUT    /api/v1/enrollments/{enrollment}

GET/POST/PUT    /api/v1/attendance/sessions
POST            /api/v1/attendance/sessions/{session}/submit
POST            /api/v1/attendance/sessions/{session}/approve

GET/POST/PUT    /api/v1/assignments
POST            /api/v1/assignments/{assignment}/publish
GET             /api/v1/assignments/{assignment}/submissions
POST            /api/v1/assignments/{assignment}/submissions
PUT             /api/v1/submissions/{submission}/grade

GET/POST/PUT    /api/v1/exams
POST            /api/v1/exams/{exam}/open
POST            /api/v1/exams/{exam}/close
POST            /api/v1/exam-results/{result}/submit
POST            /api/v1/exam-results/{result}/approve
POST            /api/v1/exam-results/{result}/publish
GET             /api/v1/students/{student}/results
GET             /api/v1/students/{student}/report-cards

GET/POST/PUT    /api/v1/fee-structures
GET/POST/PUT    /api/v1/invoices
GET/POST        /api/v1/payments
POST            /api/v1/payments/{payment}/verify
POST            /api/v1/payments/{payment}/refund
GET             /api/v1/payments/{payment}/receipt
GET             /api/v1/finance/outstanding
GET             /api/v1/finance/summary

GET/POST/PUT    /api/v1/admissions
POST            /api/v1/admissions/{application}/review
POST            /api/v1/admissions/{application}/approve
POST            /api/v1/admissions/{application}/reject
```

Use pagination for large collections. Support safe search/filter/sort.
Never expose internal SQL/errors.

## 25. Authentication/security

Use Laravel Sanctum. Support login, logout, password reset, session
security, optional email verification, throttling, strong password rules
and 2FA-ready architecture.

Security requirements:

-   HTTPS
-   CSRF/session protections as appropriate
-   password hashing
-   server-side authorization
-   validation
-   XSS/SQL-injection protections through framework-safe patterns
-   rate limiting
-   secure cookies
-   private files
-   least-privilege database accounts
-   audit logging
-   safe error responses
-   secret management

Frontend route guards are UX only; backend policies are authoritative.

## 26. Audit logs

Audit sensitive operations: authentication/security events,
user/role/permission changes, student/enrollment changes, attendance
edits, score changes, result approval/publication,
invoice/payment/refund changes, admission decisions, sensitive file
access and settings changes.

Never log passwords, tokens, API/R2 secrets, private keys or card data.

## 27. Dashboards

Admin: student/teacher/parent/class counts, attendance rate, outstanding
fees, admissions pipeline, attendance, collections, results awaiting
approval, events, announcements and audit activity; quick actions for
common tasks.

Teacher: assigned classes, timetable, attendance due, assignments to
grade, results to complete and announcements.

Student: current class, timetable, attendance, assignments, published
results, announcements, optional fees, report card and resources.

Parent: child selector, child summaries, attendance, results, fees,
assignments, events, announcements and invoice/payment/receipt actions.

## 28. Queues and scheduler

Use Redis-backed queues for:

``` text
GenerateReportCard
GenerateReceipt
SendNotification
SendEmail
ProcessCSVImport
ProcessBulkAnnouncement
ProcessPaymentWebhook
GenerateExport
ProcessImage
```

Scheduler may handle fee reminders, attendance reminders, scheduled
announcements, admission expiration, report jobs, cleanup and backups.
Jobs must be safe to retry.

## 29. Environment strategy

Three environments:

``` text
LOCAL -> STAGING (.dev) -> PRODUCTION
```

Local uses native macOS development where possible. Staging has separate
PostgreSQL, Redis, R2 and secrets. Production is completely separate.

Never share production credentials with staging. Never use real student
data in staging.

## 30. Developer Mac constraints

Primary development machine:

``` text
2017 MacBook
macOS 13
Intel Core i5, 3.1 GHz dual-core
8 GB 2133 MHz LPDDR3
```

Prefer native tooling. Do not require Docker Desktop initially. Avoid
Kubernetes and unnecessary background services. Redis can be started
only when required if memory is constrained.

Recommended local tools:

``` text
Git
Homebrew
PHP 8.4+
Composer
Node.js LTS
npm
PostgreSQL
Redis
TRAE CN
GitHub CLI (optional)
```

Git is version control; Homebrew is the package manager.

## 31. Local setup order

``` bash
git --version
brew --version
brew install php
brew install composer
brew install node
brew install postgresql
brew install redis
brew install gh
```

Verify:

``` bash
php -v
composer --version
node -v
npm -v
psql --version
redis-server --version
git --version
gh --version
```

Do not continue to application development until the required local
services work.

## 32. Repository

Recommended monorepo:

``` text
vcs-school-management-system/
├── README.md
├── PROJECT_RULES.md
├── .env.example
├── .gitignore
├── frontend/
├── backend/
├── docs/
├── scripts/
└── .github/workflows/
```

If TRAE proposes another structure, it must explain why and preserve the
approved architectural separation.

## 33. Git/GitHub

Branches:

``` text
main
develop
feature/*
fix/*
hotfix/*
```

Use pull requests and CI. Protect `main`. Keep `.env` ignored. Enable
secret scanning/push protection and dependency alerts where available.

Commit examples:

``` text
feat: add student enrollment workflow
fix: prevent duplicate attendance records
test: add parent authorization coverage
refactor: move result calculation into service
docs: update R2 deployment instructions
```

## 34. CI/CD

CI should run:

``` text
checkout
PHP/Composer setup
Node/npm setup
backend tests
frontend tests
TypeScript checks
lint/format checks
frontend production build
```

Deployment should happen only after successful checks and controlled
release procedures.

## 35. Testing

Backend tests must cover authentication, authorization, parent-child
isolation, teacher scope, student isolation, attendance uniqueness,
timetable conflicts, result workflow, grade calculations, finance,
payments, admissions, file access and audit logging.

Frontend tests cover components, forms, validation, stores, route guards
and API error states.

E2E tests cover login, student creation, parent linking, teacher
assignment, attendance, assignments, results,
invoices/payments/receipts, admissions and report cards.

## 36. Seed data

Create repeatable fake demo data for roles, permissions, users,
sessions, terms, classes, subjects and relationships. Never use real
personal data.

## 37. Performance

Use pagination, indexes, eager loading, query optimization, caching only
where justified, queues for expensive work, optimized images and
lazy-loaded frontend modules where helpful. Avoid N+1 queries and giant
API responses.

## 38. Accessibility/privacy

Use semantic HTML, labels, keyboard navigation, visible focus,
accessible errors and sufficient contrast. Collect only necessary school
data, restrict access, audit sensitive operations and do not expose
private data in URLs unnecessarily.

## 39. Cloudflare

Configure DNS, HTTPS, Full (strict) TLS, WAF, rate limiting where
appropriate and safe caching only for public/static content. Do not
cache private authenticated responses. Do not expose PostgreSQL/Redis
ports publicly. Cloudflare does not replace application authorization.

## 40. Migration order

Use this dependency-aware sequence unless a documented dependency
requires adjustment:

``` text
users -> roles -> permissions -> role_permissions -> user_roles -> school_settings
academic_sessions -> terms -> classes -> sections -> subjects -> class_subjects
students -> parents -> teachers -> staff_profiles -> student_parents
teacher_subjects -> teacher_class_assignments -> student_enrollments
timetable_entries
attendance_sessions -> attendance_records
assignments -> assignment_attachments -> assignment_submissions
assessment_types -> exams -> exam_subjects -> grading_scales -> grading_scale_items
assessment_scores -> exam_scores -> result_publications -> report_cards
fee_structures -> fee_items -> student_invoices -> invoice_items -> payments -> payment_receipts
admission_applications -> admission_documents -> admission_assessments
announcements -> notifications -> messages
events -> gallery_albums -> gallery_images
audit_logs
```

## 41. Development phases

### Phase 0 --- Infrastructure

GitHub, local tools, Vue skeleton, Laravel API skeleton, PostgreSQL,
Redis, CI, Cloudflare/R2 integration points and staging plan.

Acceptance: Vue, Laravel API, PostgreSQL, Redis, Git and CI all work.

### Phase 1 --- Foundation

API conventions, error handling, logging, database foundation, frontend
design system and navigation shell.

### Phase 2 --- Authentication/RBAC

Users, roles, permissions, Sanctum, policies, route protection, role
dashboards and audit foundation.

### Phase 3 --- Academic foundation

Sessions, terms, classes, sections, subjects, class subjects and teacher
assignments.

### Phase 4 --- People

Students, parents, teachers, staff foundation, parent-child links and
enrollment/lifecycle.

### Phase 5 --- Timetable/attendance

Timetable, conflict detection, attendance, reports and approval where
required.

### Phase 6 --- Assignments/resources

Assignments, submissions, grading, resources and R2 integration.

### Phase 7 --- Exams/results

Assessment types, exams, scores, grading scales, approval, publication
and report cards.

### Phase 8 --- Finance

Fees, invoices, payments, verification, receipts, balances and reports.

### Phase 9 --- Admissions

Applications, documents, assessments, review, decisions and
admission-to-enrollment transition.

### Phase 10 --- Communication/events

Announcements, notifications, messaging, events and gallery.

### Phase 11 --- Reports/audit

Operational reports, exports and audit UI.

### Phase 12 --- Hardening

Security, authorization, file security, rate limits, queues,
performance, accessibility and staging review.

### Phase 13 --- Production readiness

Server, Cloudflare, TLS, PostgreSQL, Redis, R2, queues, scheduler,
backups, monitoring, deployment and rollback.

### Phase 14 --- Public website

Only after the SMS is stable and production-ready.

## 42. Phase prompt for TRAE

Use this prompt for each phase:

``` text
Read README.md and PROJECT_RULES.md first.

We are working only on Phase X: [NAME].
Do not implement later phases.

Inspect the repository and report the current relevant architecture, files, database state, routes, frontend state and prerequisites.

Create a concise implementation plan.

Implement only this phase.

For completion:
- add/update migrations
- enforce validation
- enforce authorization
- add tests
- update API documentation
- update technical documentation
- run backend tests
- run frontend tests
- run TypeScript checks
- run build checks

Finally report files changed, database changes, API changes, frontend changes, tests, known issues and the next recommended step.
```

## 43. First TRAE prompt

``` text
You are working on the Victorious Children School School Management System.

Read README.md and PROJECT_RULES.md completely before making changes.
Do not build the entire system.
We are starting Phase 0.

Inspect the repository, installed versions, OS/tooling, Git state and existing frontend/backend state.

Prepare the foundation for:
Vue 3, TypeScript, Vite, Tailwind CSS, Pinia, Vue Router,
Laravel 12 API, PHP 8.4+, PostgreSQL, Redis, Laravel Sanctum,
GitHub CI and Cloudflare/R2 integration points.

Do not create business modules yet. Do not create students, teachers, finance, attendance, exams or admissions yet.

Use the README as the architecture source of truth.
Make the smallest safe changes necessary.
Run relevant checks and report the result.
```

## 44. Quality gate / definition of done

A phase is complete only when:

``` text
[ ] feature works
[ ] database migration is correct
[ ] authorization is enforced
[ ] validation exists
[ ] API is documented
[ ] UI handles loading/empty/error/success states
[ ] tests added
[ ] existing tests pass
[ ] TypeScript checks pass
[ ] build passes
[ ] security reviewed
[ ] documentation updated
[ ] Git changes reviewed
```

Production readiness additionally requires proven backups/restores,
secure R2, working queues/scheduler, monitoring, TLS, Cloudflare
configuration, deployment and rollback procedures.

## 45. Final rules

1.  SMS first; public website later.
2.  Vue 3 + TypeScript + Vite is the approved frontend.
3.  Laravel 12 is the approved backend/API.
4.  PostgreSQL is the primary database.
5.  Redis is cache/queue infrastructure, not the source of truth.
6.  Cloudflare R2 is object storage.
7.  Cloudflare is the edge/security layer.
8.  GitHub is source control.
9.  TRAE is the development environment, not the production runtime.
10. Authorization is server-side.
11. Historical academic data is preserved.
12. School policies, grading and fees are configurable.
13. Tests are part of feature completion.
14. Security is designed from the beginning.
15. Keep changes small and reviewable.
16. Never expose real student data in development/staging.
17. Do not add infrastructure without a demonstrated need.

## 46. Current approved status

``` text
Frontend       Vue 3 + TypeScript + Vite
Backend        Laravel 12 API
Database       PostgreSQL
Cache/Queues   Redis
Storage        Cloudflare R2
Edge           Cloudflare
Source control GitHub
IDE            TRAE CN
Local          2017 Intel MacBook, macOS 13, 8 GB RAM
Staging        dedicated .dev hostname
Production     separate environment/domain
Website        deferred
```

**This document is the authoritative implementation guide for TRAE.**
