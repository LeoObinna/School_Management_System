# TRAE CN MASTER DEVELOPMENT README

## Victorious Children School --- School Management System (SMS)

### Nuxt 4 + TypeScript + Vue 3 + Nitro + Cloudflare Workers + PostgreSQL + Cloudflare R2

> **MASTER SOURCE OF TRUTH.** Build the authenticated SMS first. Build
> the public school website later.
>
> This README is the single authoritative project specification. The
> supporting documents `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`,
> `ARCHITECTURE_DECISION_RECORD.md`, and `MIGRATION_PLAN.md` record the
> reasoning and migration history; they do not override this README.

## 1. Final architecture

This project uses the following approved stack:

-   Frontend + server: Nuxt 4 (Vue 3, TypeScript, Nitro server routes).
-   Database: PostgreSQL (source of truth; never D1 for primary data).
-   ORM: Drizzle ORM (type-safe PostgreSQL).
-   Validation: zod schemas shared between client and server.
-   Compute: Cloudflare Workers (Nitro `cloudflare-pages` preset).
-   Files: Cloudflare R2 through Worker bindings / S3-compatible access.
-   Background jobs: Cloudflare Queues; scheduled tasks: Cron Triggers.
-   Database pooling: Cloudflare Hyperdrive (Workers to PostgreSQL).
-   Edge/security: Cloudflare DNS, TLS, WAF, rate limiting.
-   Source control: Git + GitHub.
-   AI IDE: TRAE CN.
-   Testing: Vitest, @vue/test-utils, Playwright (future E2E).
-   Production: Cloudflare Workers + managed PostgreSQL (Neon/Supabase)
    behind Cloudflare.

Architecture:

``` text
Cloudflare (DNS, TLS, WAF, CDN)
   |
   v
Nuxt 4 — Vue 3 + TypeScript (pages/components)
   |
   v
Nitro server routes /api/v1 (auth, RBAC, validation, domain logic)
   |
   +---- PostgreSQL (source of truth, via Hyperdrive)
   +---- Cloudflare R2 (objects/files)
   +---- Cloudflare Queues (background jobs)
```

Do not introduce React/Next.js, Laravel, D1 as a primary database,
MySQL/MongoDB, or a second backend framework without an explicitly
approved Architecture Decision Record.

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
Frontend + backend: Nuxt 4 + TypeScript (Vue 3 + Nitro).
Database: PostgreSQL.
Object storage: Cloudflare R2.
Compute: Cloudflare Workers. Background jobs: Cloudflare Queues.

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript across client and server.
Use reusable components.
Use zod schemas for validation (shared in shared/schemas/).
Use Nitro server middleware for authentication and RBAC.
Use server/services/ for multi-step domain workflows.
Use database transactions for multi-write operations.
Use PostgreSQL as the source of truth — never D1 for primary data.
Use R2 for objects, PostgreSQL for file metadata.
Keep server routes thin; domain logic lives in server/services/.
Never hard-code secrets or school policy.
Never trust client authorization claims.
Preserve historical records.
Add tests for critical behavior and authorization boundaries.
Run type-check, tests, lint and build before completing a phase.
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

## 10. Application structure (client)

``` text
app/
├── app.vue
├── pages/              # file-based routing (auth/admin/teacher/student/parent)
├── components/         # {ui,forms,tables,charts,navigation,feedback}
├── layouts/
├── composables/
├── middleware/         # client route guards (UX only)
├── plugins/
├── stores/             # Pinia
├── assets/
└── public/
```

Use a centralized API access layer (`$fetch` wrappers / composables);
do not scatter raw HTTP calls throughout components. Use Pinia for
genuinely shared state, not every API response.

## 11. Server / API structure (Nitro)

``` text
server/
├── api/v1/             # server routes (thin: validate, authorize, respond)
├── middleware/         # auth session + RBAC enforcement
├── services/           # multi-step domain workflows
├── repositories/       # Drizzle data access
├── plugins/
└── utils/

shared/
├── types/              # types shared by client and server
└── schemas/            # zod validation schemas

database/
├── schema/             # Drizzle table definitions
├── migrations/         # generated SQL migrations
└── seeds/
```

Keep server routes thin. Use Drizzle relationships, zod validation,
server middleware authorization and database transactions. Client route
guards are UX only; server middleware is authoritative.

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

Use Nitro server middleware with signed, HTTP-only, Secure, SameSite
session cookies. Support login, logout, password reset, session
security, optional email verification, throttling, strong password
rules and 2FA-ready architecture. (Sessions may use cookie-only signed
state or Cloudflare KV server-side sessions if revocation requires it.)

Security requirements:

-   HTTPS
-   CSRF protection for state-changing cookie-authenticated requests
-   password hashing (argon2/bcrypt via Web Crypto or a vetted library)
-   server-side authorization (Nitro middleware, never UI-only checks)
-   validation (zod on every server route)
-   XSS/SQL-injection protections through Vue auto-escaping and Drizzle
    parameterized queries
-   rate limiting (Cloudflare WAF plus server-side limits)
-   secure cookies
-   private files
-   least-privilege database accounts
-   audit logging
-   safe error responses
-   secret management (Codespace/GitHub/Cloudflare secrets)

Frontend route guards are UX only; server middleware is authoritative.

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

Use Cloudflare Queues for work that must not block a request or that
exceeds Worker CPU limits:

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

Cloudflare Cron Triggers handle scheduled work: fee reminders,
attendance reminders, scheduled announcements, admission expiration,
report jobs and cleanup. Jobs must be safe to retry and idempotent.
Critical database writes remain transactional and are never deferred
to a queue.

## 29. Environment strategy

Three environments:

``` text
CODESPACE (dev) -> STAGING -> PRODUCTION
```

### Local development (Codespace)

Development happens in **GitHub Codespaces** — a cloud-hosted Linux
container with Node 24, PostgreSQL 16 and wrangler pre-installed via
`.devcontainer/`. The devcontainer runs a local PostgreSQL for schema
and migration work; no Redis is required (Cloudflare Queues replace it).
The developer's Mac is a thin client.

### Remote / managed services

-   Staging and production PostgreSQL run on a managed provider
    (Neon/Supabase), reached from Workers via Cloudflare Hyperdrive.
-   R2 objects, Queues and the Worker runtime are Cloudflare-managed.
-   No PHP, Composer, Redis server, or long-lived application server is
    required anywhere.

### Staging

Cloudflare Pages/Workers staging deployment, separate `sms-staging` R2
bucket, separate managed PostgreSQL database and separate secrets.

### Production

Cloudflare Workers production deployment, `sms-production` R2 bucket,
separate production PostgreSQL, Full (strict) TLS and WAF. Never share
production credentials with staging. Never use real student data in
staging. See `docs/CODESPACES.md` for setup details.

## 30. Developer machine

The primary development machine is a 2017 Intel MacBook (macOS 13,
8 GB RAM). It serves as a **thin client** only — it runs TRAE CN and a
browser to connect to GitHub Codespaces. No local PHP, Composer,
Redis, Docker or Homebrew is required. Node 24 is sufficient if the
Nuxt dev server is ever run locally; PostgreSQL can be remote.

If a developer has a more powerful machine, they may optionally run the
devcontainer locally via VS Code / Docker. This is a convenience, not a
requirement.

What the Mac needs:

``` text
TRAE CN (IDE)
A modern browser
Git (optional — Codespaces has Git built in)
GitHub account with Codespaces access
```

## 31. Codespaces setup

Open the repository in a GitHub Codespace. The `.devcontainer/`
configuration automatically installs:

``` text
Node.js 24 + npm
PostgreSQL 16 (local dev database)
wrangler (Cloudflare CLI)
GitHub CLI
```

To create a Codespace:

``` text
GitHub.com → Repo → Code → Codespaces → Create codespace on main
```

Or via CLI:

``` bash
gh codespace create --repo <owner>/<repo> --branch main
```

The devcontainer `postCreate` script creates the local `sms` database,
installs app dependencies (`npm install --legacy-peer-deps`), runs
`nuxt prepare`, type-check and tests.

Verify inside the Codespace:

``` bash
node -v
npm -v
npx wrangler --version
psql --version
git --version
gh --version
```

Do not continue to application development until the Codespace is running
and the required services are healthy.

## 32. Repository

Monorepo:

``` text
School_Management_System/
├── README.md                  # master source of truth
├── PROJECT_RULES.md
├── ARCHITECTURE_FEASIBILITY_ASSESSMENT.md
├── ARCHITECTURE_DECISION_RECORD.md
├── MIGRATION_PLAN.md
├── .env.example
├── .gitignore
├── app/                       # Nuxt 4 application (client + Nitro server)
├── frontend/                  # original Vue 3 scaffold (preserved reference)
├── docs/
└── .github/workflows/
```

The original `frontend/` Vue 3 scaffold is preserved until the Nuxt app
reaches feature parity. Deletion requires an explicit approved
checkpoint.

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

CI (`.github/workflows/ci.yml`, single job in `app/`) runs:

``` text
checkout
Node 24/npm setup
PostgreSQL 16 service
npm ci --legacy-peer-deps
nuxt prepare
nuxt typecheck (strict TypeScript)
vitest (unit/component/server tests)
nuxt build (Cloudflare Pages output)
```

Deployment to Cloudflare happens only after successful checks and
controlled release procedures (`wrangler pages deploy`), using GitHub
repository secrets. Never deploy without passing tests.

## 35. Testing

Server tests (Vitest) must cover authentication, authorization,
parent-child isolation, teacher scope, student isolation, attendance
uniqueness, timetable conflicts, result workflow, grade calculations,
finance, payments, admissions, file access and audit logging.

Client tests cover components, forms, validation, stores, route guards
and API error states.

E2E tests (Playwright, future) cover login, student creation, parent
linking, teacher assignment, attendance, assignments, results,
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

Approved Cloudflare services and their purpose:

``` text
Workers     — Nuxt/Nitro application runtime (SSR + API)
R2          — object storage (files, photos, documents, receipts)
Hyperdrive  — PostgreSQL connection pooling from Workers
Queues      — background jobs (reports, emails, notifications, images)
Cron Triggers — scheduled tasks
DNS         — domain management
TLS         — HTTPS at the edge (Full strict)
WAF         — managed and custom firewall rules
Rate Limiting — edge-level throttling (e.g. /api/v1/auth/login)
```

KV is permitted only for non-authoritative caching or server-side
sessions if required; the relational database remains the source of
truth. Durable Objects are permitted only where strong-consistency
coordination is demonstrated (e.g. a timetable booking lock). **D1 is
not used for primary data.**

Configure safe caching only for public/static content. Do not cache
private authenticated responses. Do not expose PostgreSQL ports
publicly. Cloudflare does not replace application authorization.

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

### Phase 0 --- Infrastructure & architecture migration  ✅ COMPLETE

Nuxt 4 scaffold (`app/`), Cloudflare Pages/Workers Nitro preset,
Drizzle ORM, PostgreSQL connection, foundation schema (users, roles,
permissions, join tables, school settings, audit logs), R2/Hyperdrive/
Queues wrangler bindings, Tailwind v4, Pinia, Vitest, devcontainer
(Node 24 + PostgreSQL 16), single-job CI.

Acceptance: Nuxt app builds for Cloudflare, type-check/tests pass,
migration SQL generates, Codespace and CI configured. — MET.

### Phase 1 --- Foundation  ✅ COMPLETE

Full PostgreSQL schema (all tables in §12/§40 via Drizzle), shared zod
schemas and TypeScript domain types, database seeders (fake demo data),
API conventions/error handling, and the frontend design system /
navigation shell.

Delivered in this migration increment (data layer foundation):

- Domain-split Drizzle schema under `app/database/schema/`
  (`enums`, `core`, `academics`, `people`, `enrollment`, `attendance`,
  `assignments`, `exams`, `finance`, `admissions`, `communication`,
  `events`) aggregated by `schema/index.ts`: **52 tables, 16 pg enums**.
- All money and grade/score columns use `NUMERIC` (20 such columns);
  no `real`/`double precision` anywhere.
- Shared zod validation foundation in `app/shared/schemas/`
  (`common`, `auth`, `academics`) reused by client and Nitro server.
- Idempotent RBAC + demo seeder: `app/database/seeds/` (permission
  catalog from §8, five roles, role/permission grants, five fake demo
  users with PBKDF2-hashed passwords (the Web Crypto hashing util was
  added in Phase 2; the seeder was re-pointed to it), school settings, one current
  session + three terms, starter classes/sections/subjects). Run with
  `npm run db:seed` (`DATABASE_URL` required; `SEED_PASSWORD` optional).
- Initial migration `0000_clever_garia.sql` regenerated from the full
  schema.
- Checks: `nuxt typecheck` exit 0, Vitest **20/20 pass**, `nuxt build`
  succeeds for the `cloudflare-pages` preset.

Not yet done in Phase 1 (deferred to keep increments small): API
conventions/error-handling middleware and the frontend design system /
navigation shell — these lead directly into Phase 2.

Acceptance: complete schema generates; migrations are reproducible;
validation and RBAC seed data are tested; type-check, tests and build
all pass. — MET for the data-layer foundation.

### Phase 2 --- Authentication/RBAC  ✅ COMPLETE

Users, roles, permissions, Nitro auth middleware (signed HTTP-only
cookies), RBAC permission middleware, client route protection, role
dashboards and audit foundation.

Delivered in this increment:

-   **Password hashing** with the Web Crypto API
    (`app/server/utils/auth/password.ts`): PBKDF2-HMAC-SHA-512,
    210,000 iterations, 16-byte salt, 64-byte key. Stored as
    `pbkdf2$sha512$<iter>$<salt>$<hash>`. Chosen over argon2/bcrypt so
    the same code runs natively on both Cloudflare Workers and Node
    without native bindings. Includes a password fingerprint used to
    invalidate reset tokens after a password change. The demo seeder
    now uses this util (its old scrypt hashes are upgraded on upsert).
-   **Signed, purpose-bound tokens** (`tokens.ts`): HMAC-SHA-256
    session tokens (7-day TTL, 30 days when "remember me") and
    1-hour password-reset tokens, formatted
    `<payloadB64url>.<sigB64url>` and verified constant-time. Sessions
    are cookie-only (no server-side session/KV store yet).
-   **Secure cookies** (`cookies.ts`): `sms_session` is HTTP-only,
    `Secure`, `SameSite=Lax`, `path=/`; a non-HTTP-only `sms_csrf`
    cookie supports the double-submit CSRF check.
-   **Auth context + RBAC** (`context.ts`, `permissions.ts`,
    `rbac.ts`): on every request the session is verified and the
    user's roles/permissions are aggregated in one SQL query.
    `requireUser` (401), `requireRole` and `requirePermission(slug)`
    (403) guard server routes; `super_admin` has wildcard access.
    Client route guards in `app/middleware/auth.global.ts` are UX only
    --- the server guards are authoritative.
-   **CSRF middleware** (`middleware/00.auth.ts`): authenticated
    state-changing `/api/` requests (non-GET/HEAD/OPTIONS) must send a
    valid `x-csrf-token` header matching the session-derived CSRF
    token. Safe methods and unauthenticated requests are exempt.
-   **Endpoints** under `/api/v1/auth`: `login`, `logout`, `me`,
    `forgot-password`, `reset-password`. Login uses a sliding-window
    rate limiter (10 attempts / 5 min per IP+email) with a
    `Retry-After` header, returns one generic error for unknown email
    or wrong password, and stamps `lastLoginAt`.
-   **Audit logging** (`utils/audit.ts`): login success/failure,
    logout and password reset are written to `audit_logs` (best
    effort) with sensitive fields stripped and the client IP recorded.
-   **Client**: `app/services/api.ts` (sends cookies, attaches the
    CSRF header automatically), Pinia `useAuthStore` with a `can()`
    permission getter, a global route guard, a login page and a
    protected dashboard that demonstrates role/permission rendering.
-   Validation failures return a uniform `422` with a field-level
    `data.errors` map (shared zod schemas).
-   Checks: `nuxt typecheck` exit 0, Vitest **46/46 pass** (7 files),
    `nuxt build` succeeds for the `cloudflare-pages` preset.

Known limitations (deferred by design):

-   The login limiter is in-memory and therefore per Worker isolate;
    a shared KV/Durable Object limiter and WAF rules come with
    hardening (Phase 12/13).
-   No server-side session revocation yet (stateless signed cookies);
    logout clears the cookie. A revocation list (KV/DB) is a later
    hardening item.
-   Forgot-password returns the reset token only when the server-only
    `EXPOSE_RESET_TOKENS` flag is true (local dev); real email delivery
    is deferred to Phase 10 (Queues/communication).
-   Endpoint-level HTTP integration tests are not included (no live
    PostgreSQL on the Mac); the crypto, token, RBAC and throttle logic
    is covered by pure unit tests. Parent/child row-level data
    isolation is enforced alongside the modules that own that data.

Acceptance: auth works end-to-end, RBAC is enforced server-side,
type-check/tests/build all pass. --- MET (pending live verification in
Codespaces with PostgreSQL).

### Phase 3 --- Academic foundation  ✅ COMPLETE

Sessions, terms, classes, sections, subjects, class subjects and teacher
assignments.

Delivered:

-   Shared zod schemas (`shared/schemas/academics.ts`) and API types
    (`shared/types`) for every Phase 3 resource, including date-order
    rules, partial/no-op-update rejection, uuid relation checks and a
    `booleanParamSchema` preprocessor (`"false"` must not coerce to
    `true`). `maxScore: null` explicitly clears a class-subject score.
-   Server services: `academic-structure.ts` (sessions, terms,
    classes, sections, subjects and class subjects) and
    `teacher-academics.ts` (teacher lookup, teacher subjects and class
    assignments). Server-side invariants: slugs are derived and
    uniquified server-side; setting a session/term current clears the
    flag on siblings inside a transaction; term dates must sit inside
    the session; assignment creation verifies the teacher, class,
    session and subject exist, the section belongs to the class and
    the class offers the subject; duplicate links return 409.
-   Thin Nitro routes under `/api/v1` (27 route files) with
    `requirePermission` checks (`*.view` / `*.manage`,
    `class_subjects.manage`, `teacher_assignments.manage`,
    `teachers.view`), 422 validation, 404/409 mapping, 201 on create
    and audit records for every mutation. Structure deletes are
    deactivations (`isActive = false`) to preserve history; teacher
    links/assignments are removed directly.
-   Server utilities: `smsSlugify`, pagination envelope helper,
    Date→JSON serializers, Postgres error classifiers (23505/23503)
    and typed query/body parsing.
-   Client: `put`/`del` on the api service, typed
    `services/academics.ts`, a `usePaginated` collection composable,
    an accessible `UiBaseModal`, and four permission-guarded pages —
    `academics/sessions` (sessions + terms tabs), `academics/classes`
    (class detail with sections and offered subjects),
    `academics/subjects` and `academics/assignments` (teacher subjects
    and class allocations). Dashboard gains gated Academics links.
-   RBAC catalog: teachers additionally receive
    `academic_sessions.view` and `terms.view` so they can read the
    academic calendar.
-   Seeder: four fake teachers (one linked to the demo teacher login),
    teacher-subject capability links and four teacher class
    assignments for the current session. Fully idempotent; no real
    personal data.
-   No database migration was required — all Phase 3 tables existed in
    the Phase 1 schema and initial migration.

Known limitations (deferred by design):

-   Teacher profile CRUD (staff records, user linking, lifecycle) is
    Phase 4; Phase 3 seeds minimal teachers only so assignments work.
-   No endpoint-level HTTP integration tests yet (no live PostgreSQL on
    the Mac): the new logic is covered by 33 pure unit tests (schema
    contract + slug helper); live verification in Codespaces is
    pending.
-   Class/section student capacity enforcement and timetable conflict
    checks arrive with Phases 4/5.

Acceptance: full academic foundation CRUD works through authorized
endpoints and admin UI, relations and single-current invariants are
enforced server-side, type-check, 79 tests and Cloudflare build pass.
--- MET (pending live verification in Codespaces with PostgreSQL).

### Phase 4 --- People  ✅ COMPLETE

Students, parents, teachers, staff foundation, parent-child links and
enrollment/lifecycle.

**Delivered**

- Shared zod schemas and TypeScript types for students, parents,
  teachers, staff, student-parent links and enrollments
  (`app/shared/schemas/people.ts`, `app/shared/types/index.ts`).
- People service (`app/server/services/people.ts`) with full CRUD,
  soft-delete (archive/deactivate via `deletedAt`), parent↔student
  linking, and enrollment lifecycle.
- 31 Nitro routes under `/api/v1` (students, parents, teachers, staff,
  enrollments) with RBAC + audit logging. See `docs/API.md` Phase 4.
- `staff.view/.create/.update/.delete` permissions added to the RBAC
  catalog; admin inherits all.
- Client service (`app/services/people.ts`) and 5 admin pages:
  `students.vue` (with guardian links and enrollment history),
  `parents.vue`, `teachers.vue`, `staff.vue`, `enrollments.vue`.
  Dashboard gains a **People** section gated by permissions.
- Demo data: 4 students, 3 parents, parent-child links and current-term
  enrollments seeded.
- Enrollment `create` validates student/session/class (and term-in-
  session, section-in-class) and returns `409` on duplicate placement.
- Migration `0001_glossy_golden_guardian.sql` adds unique indexes on
  `parents.email` and `staff_profiles.staff_number` so seeder upserts
  are idempotent.

**Limitations / known**

- No live PostgreSQL verification on the Mac thin client; schema logic
  covered by `app/shared/__tests__/people.test.ts` (18 cases).
- `parents.link_children` permission controls student-parent link
  routes (POST/PUT/DELETE).
- Enrollment delete uses the `enrollments.update` permission (no
  `enrollments.delete` exists in the catalog).

### Phase 5 --- Timetable/attendance  (current)

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

Cloudflare Workers, TLS/WAF, managed PostgreSQL, Hyperdrive, R2, Queues,
Cron Triggers, backups, monitoring, deployment and rollback.

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
- add/update Drizzle migrations
- enforce zod validation
- enforce server-side authorization
- add tests
- update API documentation
- update technical documentation
- run vitest
- run nuxt typecheck
- run nuxt build

Finally report files changed, database changes, API changes, client changes, tests, known issues and the next recommended step.
```

## 43. First TRAE prompt

> Historical record of the original Phase 0 prompt under the former
> planned stack. Superseded by the approved Nuxt 4 architecture (§1);
> retained for history. Use the §42 phase prompt for current work.

``` text
You are working on the Victorious Children School School Management System.

Read README.md and PROJECT_RULES.md completely before making changes.
Do not build the entire system.
We are starting Phase 0.

Inspect the repository, Codespace state, devcontainer, installed versions, Git state and existing frontend/backend state.

Prepare the foundation for:
Vue 3, TypeScript, Vite, Tailwind CSS, Pinia, Vue Router,
Laravel 12 API, PHP 8.4+, PostgreSQL, Redis, Laravel Sanctum,
GitHub Codespaces, CI and Cloudflare/R2 integration points.

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
2.  Nuxt 4 + Vue 3 + TypeScript is the approved application stack.
3.  Nitro server routes (Cloudflare Workers) are the approved backend/API.
4.  PostgreSQL is the primary database (never D1 for primary data).
5.  Cloudflare Queues handle background jobs; the DB is the source of truth.
6.  Cloudflare R2 is object storage.
7.  Cloudflare is the compute, edge and security layer.
8.  GitHub is source control.
9.  TRAE is the development environment, not the production runtime.
10. Authorization is server-side (Nitro middleware).
11. Historical academic data is preserved.
12. School policies, grading and fees are configurable.
13. Tests are part of feature completion.
14. Security is designed from the beginning.
15. Keep changes small and reviewable.
16. Never expose real student data in development/staging.
17. Do not add infrastructure without a demonstrated need.

## 46. Current approved status

``` text
Application    Nuxt 4 (Vue 3 + TypeScript) + Nitro server routes
Runtime        Cloudflare Workers (cloudflare-pages preset)
Database       PostgreSQL 16 (managed in staging/prod; Hyperdrive)
ORM            Drizzle
Validation     zod (shared schemas)
Background     Cloudflare Queues + Cron Triggers
Storage        Cloudflare R2
Edge           Cloudflare DNS / TLS / WAF / rate limiting
Source control GitHub
CI             GitHub Actions (single Nuxt job)
IDE            TRAE CN
Dev env        GitHub Codespaces (.devcontainer/: Node 24 + PostgreSQL)
Mac            thin client only (TRAE CN + browser)
Staging        Cloudflare Workers staging + sms-staging R2 + staging PG
Production     separate Workers env + sms-production R2 + production PG
Website        deferred
Current phase  Phase 5 — Timetable/attendance (Phases 0–4 complete)
```

**This document is the authoritative implementation guide for TRAE.**

## 47. Architecture migration status

The project has **approved the migration** from the previously planned
Vue 3 + Laravel 12 architecture to **Nuxt 4 + Cloudflare Workers**,
while **retaining PostgreSQL** as the primary database.

-   Phase 0 feasibility assessment and decision: complete.
-   Phase 0 infrastructure (Nuxt 4 scaffold, Nitro Cloudflare preset,
    Drizzle, bindings, CI/devcontainer): complete.
-   Phase 1 data-layer foundation: complete — 52-table domain schema,
    shared zod schemas, idempotent RBAC/demo seeder, initial migration;
    type-check, 20 tests and Cloudflare build all pass.
-   Phase 2 authentication/RBAC: complete — Web Crypto PBKDF2 password
    hashing, HMAC-signed cookie sessions, double-submit CSRF
    protection, server-side `requireUser`/`requireRole`/
    `requirePermission` guards, login/logout/me/forgot/reset endpoints,
    login throttling, audit logging and a protected client
    (api service, Pinia auth store, route guard, login + dashboard);
    type-check, 46 tests and Cloudflare build all pass.
-   Phase 3 academic foundation: complete — sessions, terms, classes,
    sections, subjects, class subjects, teacher subjects and teacher
    class assignments with server-derived unique slugs, single-current
    session/term transactions, date and relation invariants, 409
    duplicate handling, RBAC + audit on 27 Nitro routes, four
    permission-guarded admin pages, fake-teacher demo seeding and
    refreshed API docs; no schema migration needed; type-check,
    79 tests and Cloudflare build all pass.
-   The migration is performed **incrementally**, one phase at a time.
-   Existing work is preserved: the original `frontend/` Vue 3 scaffold
    remains in the repository as a reference until the Nuxt app reaches
    feature parity. No destructive migration is authorized.
-   No production system exists yet, so there is no production data at
    risk; the original Laravel backend was never scaffolded.
-   PostgreSQL remains primary. It must never be silently replaced by
    D1. Historical academic records and durable, auditable financial
    records remain mandatory.
-   The public school website remains deferred until the SMS is stable.
-   Current phase: **Phase 5 — Timetable/attendance** (Phases 0–4 done).

## 48. Architecture decision (summary)

**Previous direction:** Vue 3 + Vite frontend, Laravel 12 API,
PostgreSQL, Redis, Cloudflare R2/edge.

**Approved direction:** Nuxt 4 + TypeScript + Vue 3 + Nitro on
Cloudflare Workers, PostgreSQL (via Hyperdrive), R2, Queues.

**Reason (evidence-based; full detail in the assessment document):**
single TypeScript stack for client and server; reduced infrastructure
and operational overhead (no PHP/Redis servers); native Cloudflare
compute, scaling and generous free tier; good fit for the 2017 MacBook
via Codespaces; PostgreSQL retained for relational, financial and
reporting correctness; the backend had not yet been built, so the move
was low-risk. Weighted score: Nuxt option 8.75 vs Laravel option 7.60.

## 49. Documentation hierarchy

1.  **Primary source of truth:** this `README.md`.
2.  **Supporting decision records** (history and rationale; they do not
    override this README):
    -   `ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`
    -   `ARCHITECTURE_DECISION_RECORD.md`
    -   `MIGRATION_PLAN.md`
3.  Operational docs live in `docs/`; hard rules live in
    `PROJECT_RULES.md`.

A future significant architecture change requires updating this README
and creating/updating an Architecture Decision Record — never a
competing README.

## 50. Migration plan reference

Migration is incremental and sequential (see `MIGRATION_PLAN.md` for
full detail). Existing work must be preserved; each phase must pass its
tests and quality gate before the next begins; destructive changes
require explicit approval. The migration plan is supporting
documentation, not a second specification.

## 51. Change log

``` text
2026-09-11  Phase 0  Architecture feasibility + decision: approved
                    migration from planned Vue/Laravel to Nuxt 4 +
                    Cloudflare Workers; PostgreSQL retained.
2026-09-11  Phase 0  Infrastructure: Nuxt 4 app scaffolded (app/),
                    Cloudflare Pages preset, Drizzle + PostgreSQL
                    foundation schema, R2/Hyperdrive/Queues bindings,
                    Tailwind, Pinia, Vitest, devcontainer and CI
                    updated; type-check/tests/build pass.
2026-09-11  Phase 1  Data-layer foundation: schema split into 11
                    domain files (52 tables, 16 enums); NUMERIC used
                    for all money/scores; shared zod schemas; idempotent
                    RBAC + demo seeder and db:seed script; initial
                    migration regenerated; type-check, 20 tests and
                    Cloudflare build pass.
2026-09-11  Phase 2  Authentication/RBAC: Web Crypto PBKDF2-HMAC-SHA-512
                    password hashing (seeder re-pointed to it); HMAC
                    signed session + reset tokens in HTTP-only Secure
                    SameSite=Lax cookies; double-submit CSRF middleware;
                    per-request auth context with requireUser/requireRole/
                    requirePermission guards; login/logout/me/forgot/
                    reset endpoints with sliding-window login throttle
                    and audit logging; client api service, Pinia auth
                    store, global route guard, login page and protected
                    dashboard; type-check, 46 tests and Cloudflare build
                    pass.
2026-09-12  Phase 3  Academic foundation: sessions, terms, classes,
                    sections, subjects, class subjects, teacher subjects
                    and teacher class assignments; shared zod schemas
                    and types; services with slug derivation,
                    single-current transactions and relation
                    invariants; 27 RBAC/audited Nitro routes with 404/
                    409/422 handling; typed academics client service,
                    pagination composable, modal and four admin pages
                    with dashboard links; teacher view permissions
                    extended; idempotent fake-teacher seeding; docs/API
                    rewritten; no migration needed; type-check,
                    79 tests and Cloudflare build pass.
```
