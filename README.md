# TRAE CN MASTER DEVELOPMENT README

## Victorious Children School --- School Management System (SMS)

### Nuxt 4 + TypeScript + Vue 3 + Nitro + Cloudflare Workers + D1 + R2 + KV

> **MASTER SOURCE OF TRUTH.** Build the authenticated SMS first. Build
> the public school website later.
>
> This README is the single authoritative project specification. The
> v2.0 D1 spec package at `docs/spec/v2/` (placed 2026-09-21) is the
> canonical directive for the D1 migration. PostgreSQL/Neon/Hyperdrive
> were decommissioned on 2026-09-24; D1 is the sole database engine
> (see §51 change log and §52).

## 1. Final architecture

This project uses the following approved stack:

-   Frontend + server: Nuxt 4 (Vue 3, TypeScript, Nitro server routes).
-   Database: Cloudflare D1 (SQLite) — sole database engine in every
    environment (decommissioned PostgreSQL/Neon/Hyperdrive 2026-09-24).
-   ORM: Drizzle ORM (SQLite dialect).
-   Validation: zod schemas shared between client and server.
-   Compute: Cloudflare Workers + Workers Static Assets (Nitro
    `cloudflare-module` preset, deployed manually with Wrangler).
-   Files: Cloudflare R2 through Worker bindings only (no S3 keys).
-   Background jobs: Cloudflare Queues; scheduled tasks: Cron Triggers.
-   Edge state: Cloudflare KV (rate limiter + session revocation;
    non-authoritative).
-   Edge/security: Cloudflare DNS, TLS, WAF, rate limiting.
-   Source control: Git + GitHub.
-   AI IDE: TRAE CN.
-   Testing: Vitest, @vue/test-utils, Playwright (future E2E).
-   Production: Cloudflare Workers + D1 + R2 + KV behind Cloudflare.

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
   +---- Cloudflare D1 (authoritative; via env.DB binding)
   +---- Cloudflare R2 (objects/files)
   +---- Cloudflare KV (rate limit + session revocation; non-authoritative)
   +---- Cloudflare Queues (background jobs)
```

Do not introduce React/Next.js, Laravel, MySQL/MongoDB, Supabase,
Firebase, PlanetScale, Docker, Codespaces, or a second backend
framework without an explicitly approved Architecture Decision
Record. PostgreSQL, Neon, and Hyperdrive are decommissioned
(2026-09-24); D1 is the sole database engine.

### Type conventions (v2.0 D1 spec, 2026-09-21)

-   Money: INTEGER kobo (₦150,000 = 15,000,000).
-   Scores / weights / grade boundaries: INTEGER fixed-point ×100.
-   Timestamps: TEXT ISO-8601 UTC.
-   Dates: `YYYY-MM-DD`. Times: `HH:MM:SS`.
-   IDs: TEXT app-generated UUIDs.
-   Enums: TEXT + CHECK constraint (not pgEnum).

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
Database: Cloudflare D1 (SQLite).
Object storage: Cloudflare R2.
Compute: Cloudflare Workers. Background jobs: Cloudflare Queues.

Use Vue 3 Composition API and <script setup lang="ts">.
Use strict TypeScript across client and server.
Use reusable components.
Use zod schemas for validation (shared in shared/schemas/).
Use Nitro server middleware for authentication and RBAC.
Use server/services/ for multi-step domain workflows.
Use database transactions for multi-write operations.
Use D1 as the sole authoritative source of truth (PostgreSQL/Neon/
Hyperdrive decommissioned 2026-09-24; see §52).
Use R2 for objects, D1 for file metadata.
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

-   D1 is the sole authoritative source of truth (PostgreSQL/Neon/
    Hyperdrive decommissioned 2026-09-24 — see §52).
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
in R2 and metadata in D1.

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

D1 stores object metadata. R2 stores the object. Private objects must
remain private and be served through authorized backend access or
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
-   secret management (gitignored local `.env`; `wrangler secret put`)

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
LOCAL DEV (Mac + local D1) -> STAGING -> PRODUCTION
```

### Local development

Development runs on the local machine with Node 24 and npm from `app/`.
The D1 `DB` binding declared in `wrangler.toml` is reached through
`wrangler`'s `getPlatformProxy({ persist: true })` during both
`nuxt dev` and `wrangler dev`, with R2 emulated on local disk — no
remote Cloudflare resources and no external database server are needed
for development. No Docker, Kubernetes, Redis, Codespace, PHP, Composer
or Laravel tooling is required; background jobs use Cloudflare Queues
(Phase 10).

``` text
npm install
npm run dev       # Nuxt dev server (Node runtime; local D1 via proxy)
npm run cf:dev    # build + wrangler dev (Workers + binding emulation)
```

### Remote / managed services

-   Staging and production D1 databases are Cloudflare-managed
    (provisioned with `wrangler d1 create`); the same `DB` binding is
    reached through the Workers runtime. Nothing is provisioned
    remotely during local development.
-   R2 objects, Queues and the Worker runtime are Cloudflare-managed.
-   No PHP, Composer, Redis server, or long-lived application server is
    required anywhere.

### Staging

Worker `sms-staging` (Wrangler named environment `staging`), separate
`sms-staging` R2 bucket, separate `sms-staging` D1 database, and
separate secrets.

### Production

Worker `sms-production` (Wrangler named environment `production`),
`sms-production` R2 bucket, separate `sms-production` D1 database,
Full (strict) TLS and WAF. Never share production credentials with
staging. Never use real student data in staging.

Environments are deployed only by manual Wrangler commands from the
local machine (see §39); there is no Git-based automatic deployment.

## 30. Developer machine

The development machine (the current setup: 2017 Intel MacBook,
macOS 13, 8 GB RAM) runs the full toolchain locally. No PHP, Composer,
Redis, Docker, Kubernetes, Laravel Herd, or Codespace is required.

What the machine needs:

``` text
TRAE CN (IDE)
Node.js 24 + npm 11 (verified: Node v24.11.1 / npm 11.6.2)
Git
A modern browser
```

No external database server is required — D1 is emulated locally by
`wrangler` (Miniflare-backed SQLite under `.wrangler/state/v3/d1/`).

## 31. Local setup

``` bash
# 1. Install dependencies (from app/)
cd app
npm install

# 2. Create your local environment file (never committed)
cp .env.example .env
#    edit .env: set a random SESSION_SECRET (openssl rand -base64 48).
#    No DATABASE_URL is needed — D1 is reached through the DB binding
#    in wrangler.toml via wrangler's getPlatformProxy.

# 3. Prepare the local D1 database (Miniflare-backed, persisted under
#    .wrangler/state/v3/d1/)
npm run db:migrate
npm run db:seed        # fake demo data only

# 4. Authenticate Wrangler once (opens the browser) — only required for
#    deploys/remote operations; plain `wrangler dev` works without it
npx wrangler login
npx wrangler whoami
```

Verify:

``` bash
node -v                # expect v24.x
npm -v                 # expect 11.x
npx wrangler --version
git --version
```

Run the app:

``` text
npm run dev       # http://localhost:3000 (Node runtime; local D1 proxy)
npm run cf:dev    # Workers runtime emulation with local R2 on disk and
                  # local D1 (wrangler.toml [[d1_databases]]). Never use
                  # --remote locally.
```

Do not start feature work until these checks pass. The quality gate
before every deploy is `npm run test`, `npm run type-check` and
`npm run build` (see §34).

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

## 34. Quality gates and deployment

There is **no CI/CD deployment pipeline**: no GitHub Actions deploy, no
Cloudflare Pages Git integration, no Workers Builds, and no automatic
staging/production deployment on push or pull request. GitHub is used
strictly for source control and version history.

Before every release the developer runs the quality gate locally in
`app/`:

``` text
npm run test         # vitest (unit/component/server tests)
npm run type-check   # nuxt typecheck (strict TypeScript)
npm run build        # Nitro cloudflare-module Worker build
```

Releases are then initiated **manually** from the local machine with
Wrangler (`npm run deploy:staging` / `npm run deploy:production`; see
§39). Never deploy without passing the local checks. Apply migrations
locally with `npm run db:migrate` (D1) or remotely with `wrangler d1
migrations apply DB -e staging --remote` before deploying.

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
D1          — SQLite database (authoritative; sole database engine)
R2          — object storage (files, photos, documents, receipts)
Queues      — background jobs (reports, emails, notifications, images)
Cron Triggers — scheduled tasks
DNS         — domain management
TLS         — HTTPS at the edge (Full strict)
WAF         — managed and custom firewall rules
Rate Limiting — edge-level throttling (e.g. /api/v1/auth/login)
```

KV is permitted only for non-authoritative caching or server-side
sessions if required; D1 remains the source of truth. Durable Objects
are permitted only where strong-consistency coordination is
demonstrated (e.g. a timetable booking lock).

Configure safe caching only for public/static content. Do not cache
private authenticated responses. Cloudflare does not replace
application authorization.

### Deployment model — manual Wrangler to Workers

The Nuxt app builds with Nitro's `cloudflare-module` preset to
`.output/server/index.mjs` (the Worker) plus `.output/public` (Workers
Static Assets). `app/wrangler.toml` declares `main`, the `[assets]`
binding (`ASSETS`), and named environments `staging` and `production`,
each with its own D1 database id and R2 bucket. Bindings reach the app
through `event.context.cloudflare.env`; the D1 client is initialised
from `env.DB` per isolate (`server/plugins/cloudflare.ts` +
`server/utils/db.ts`), and R2 is used exclusively via the `R2_BUCKET`
binding (no S3 key/secret in the Worker).

``` text
Local Mac ── git push ──► GitHub (version history only; never deploys)
Local Mac ── wrangler ──► Cloudflare Workers (staging / production)
```

One-time provisioning (resources are not created by deploys):

``` text
wrangler d1 create sms-staging
wrangler d1 create sms-production
wrangler r2 bucket create sms-staging
wrangler r2 bucket create sms-production
wrangler queues create sms-notifications-staging
wrangler queues create sms-notifications-production
wrangler secret put SESSION_SECRET -e staging
wrangler secret put SESSION_SECRET -e production
```

Put the returned D1 database ids into `app/wrangler.toml` (replacing
the `REPLACE_WITH_*_D1_ID` placeholders). Apply schema remotely with
`wrangler d1 migrations apply DB -e staging --remote` (or production).

STAGING STATUS: PostgreSQL/Neon/Hyperdrive decommissioned
2026-09-24. The staging D1 database id is a placeholder until the
staging cutover (Phase 13); R2/Queue/secret provisioning will occur
during that cutover. Production is intentionally not provisioned yet
(acceptance gate).

Daily commands, run from `app/`:

``` text
npm run dev                # Nuxt dev server (Node; local D1 via proxy)
npm run cf:dev             # build + wrangler dev (full Worker emulation;
                           # local D1 via [[d1_databases]] in wrangler.toml,
                           # R2 emulated on disk; never pass --remote)
npm run deploy:staging     # build + wrangler deploy -e staging
npm run deploy:production  # build + wrangler deploy -e production
```

Release order: local quality gate (§34) → `npm run db:migrate` (local
D1) or `wrangler d1 migrations apply DB -e staging --remote` (staging)
→ manual Wrangler deploy. `SESSION_SECRET` must remain stable across
deploys; `EXPOSE_RESET_TOKENS` must never be enabled outside local
development.

The original Cloudflare Pages configuration is preserved in
`app/wrangler.pages.toml` for reference/rollback; it is not loaded by
Wrangler. Queues, Queue consumers and Cron Triggers are intentionally
absent until Phase 10.

### Observability

No extra monitoring products are required. Use Wrangler and the
Cloudflare dashboard (Workers & Pages → select `sms-staging` /
`sms-production`):

``` text
# Live request/console/error log stream for an environment (Ctrl-C to exit)
npx wrangler tail sms-staging
npx wrangler tail sms-production

# Recent deployments with version ids and upload timestamps
npx wrangler deployments list -e staging
npx wrangler deployments list -e production
```

The dashboard shows per-deployment request volume, CPU time, errors and
the currently active version id. The application emits no secrets to
logs; audit events go to the D1 `audit_logs` table, not to Worker
logs.

### Manual rollback (code only — never destructive to the database)

Each `wrangler deploy` creates an immutable Worker version. Rolling back
re-points traffic at a previous version and does not touch D1,
R2 objects, or migrations:

``` text
# 1. Find the known-good version id
npx wrangler deployments list -e staging

# 2. Roll traffic back to it
npx wrangler rollback -e staging      # prompts for confirmation
npx wrangler rollback -e production
```

Rollback applies to Worker code and configuration only. Database
migrations are not reversed automatically — migrations are kept forward-
compatible with the previously deployed Worker, and data changes must be
handled with explicit, approved forward migrations.

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

### Phase 5 --- Timetable/attendance  ✅ COMPLETE

Timetable, conflict detection, attendance, reports and approval where
required.

**Delivered**

- Shared zod schemas and TypeScript types for timetable entries and
  attendance sessions/records/reports
  (`app/shared/schemas/schedule.ts`, `app/shared/types/index.ts`).
- Schedule service (`app/server/services/schedule.ts`):
  - timetable CRUD with server-side conflict detection (teacher
    double-booked, class double-booked, room double-booked) on
    overlapping weekday slots, term/section scope aware; half-open
    intervals so back-to-back lessons are allowed; reference validation
    (term-in-session, section-in-class, subject/teacher existence);
  - attendance registers with bulk upsert marking, enrollment
    validation, open → submitted → approved workflow, approved-register
    locking;
  - class percentage report and per-student session/term history;
    attendance rate = (present + late) / total.
- 15 Nitro routes under `/api/v1/timetable` and `/api/v1/attendance`
  with RBAC (`timetable.view/.manage`, `attendance.view/.mark/.update/
  .approve`) and audit logging. See `docs/API.md` Phase 5.
- Client service (`app/services/schedule.ts`) and pages:
  `timetable.vue` (weekly grid + create/edit/delete) and
  `attendance.vue` (registers, marking roster, submit/approve, class
  report). Dashboard gains a **Schedule** section. `UiBaseModal` gains
  an optional `wide` size.
- Pure, unit-tested overlap helper (`server/utils/time.ts`).
- Seeder: 7 demo timetable entries plus one submitted Primary 1
  register with records; all pre-checked for idempotency.
- 17 new unit tests (schedule schemas + time overlap); 114 tests pass,
  type-check and Cloudflare build pass.

**Limitations / known**

- No new database migration needed (timetable/attendance tables existed
  from the initial schema); live PostgreSQL verification pending in
  Codespaces (`db:migrate` + `db:seed`).
- `attendance.export` exists in the catalog but no CSV/PDF export yet
  (deferred with reporting work).
- Configurable parent attendance notifications (README §15) are not
  built this phase (depends on Phase 10 communication).
- Student/parent attendance views are permission-gated but not yet
  row-scoped to "own timetable/own children" (consistent with prior
  phases; row-level scoping delivered in Phase 12 Part A — teachers now
  see only their own classes, students/parents their own/children's).

### Phase 6 --- Assignments/resources  ✅ COMPLETE

Assignments, submissions, grading, resources and R2 integration.

**Delivered**

- Shared zod schemas and TypeScript types for assignments, attachments,
  submissions and learning resources
  (`app/shared/schemas/assignments.ts`, `app/shared/types/index.ts`).
- Storage layer (`server/utils/storage.ts`) over the `R2_BUCKET`
  Worker binding: safe object keys (`assignments/attachments/…`,
  `assignments/submissions/…`, `resources/…`), private authorized
  download streaming, metadata/byte cleanup on delete; pure,
  unit-tested upload validation (`server/utils/uploads.ts`): size caps
  (25 MB / 50 MB), MIME allow-list and extension/MIME cross-check,
  filename sanitization; multipart helper (`server/utils/multipart.ts`).
- Assignments service (`server/services/assignments.ts`): CRUD with
  draft/scheduled/published/archived state (publishing stamps
  `publishedAt`), reference validation (term-in-session,
  section-in-class), teacher-ownership enforcement, R2-backed
  attachments; one submission per student per assignment with
  draft → submitted/late → graded/returned workflow (late derived from
  due date), graded-lock, inline score/feedback grading bounded by
  maxScore; students only see published assignments for classes (and
  sections) they are actively enrolled in.
- Resources service (`server/services/resources.ts`): school-wide or
  class/subject-scoped resource library, published visibility for
  students, metadata CRUD with R2 byte lifecycle.
- 22 Nitro routes under `/api/v1/assignments`, `/api/v1/resources` and
  `/api/v1/my`, JSON + multipart support, RBAC and audit
  (`submissions.create` added to the catalog for the student role).
  See `docs/API.md` Phase 6.
- Client service (`app/services/assignments.ts`), role-adaptive
  `pages/assignments/index.vue` (staff create/manage/attach/grade;
  students draft, upload, submit, view grades) and
  `pages/resources/index.vue` (upload, download, publish); dashboard
  gains a **Teaching** section.
- Seeder: one published Primary 1 assignment with a graded text
  submission (STU-001, 90/100) and one draft JSS 1 assignment; no
  seeded files (R2 objects cannot exist before binding configuration);
  idempotent.
- 29 new unit tests (assignment/resource schemas, upload validation,
  object-key construction); 143 tests pass, type-check and Cloudflare
  build pass.

**Limitations / known**

- File routes require the R2 binding; plain `nuxt dev` returns 503 for
  object I/O — run via `wrangler pages dev` (or staging/production).
  The S3-compatible credentials fallback in runtime config is wired in
  Phase 13. Live PostgreSQL + R2 verification pending in
  Codespaces/staging (`db:migrate` + `db:seed`).
- Magic-byte content sniffing was delivered in Phase 12 Part A
  (`sniffMagicBytes` + `assertSniffMatchesDeclared` in
  `server/utils/uploads.ts`, wired into `readUpload`); anti-malware
  scanning (e.g. a ClamAV/AV gateway) remains deferred. Validation uses
  declared MIME + extension agreement plus the magic-byte check.
- Assignment creation requires a teacher-linked account; admins create
  via a teacher login (assigning-on-behalf can be added later).
- Resource files cannot be replaced in place (delete + re-upload);
  `scheduled` assignments store `publishedAt` but are not auto-published
  by a cron yet (deployment/Queues phase).
- Parent assignment views and submission notifications are not built
  (Phase 10); gradebook/report aggregation is Phase 7.

### Phase 7 --- Exams/results  ✅ COMPLETE

Assessment types, exams, scores, grading scales, approval, publication
and report cards. Result workflow is a state machine
(`draft → submitted → approved → published`) with scores locked once
`submitted`. Students/parents only see `published` results. Report
cards have metadata + JSON view + workflow only; PDF generation is
deferred to a later phase (`objectKey` stays null). Staff `/exams` page
manages exams, scores and the publication workflow; student/parent
`/results` page shows published subject results and report cards. See
`docs/API.md` Phase 7.

### Phase 8 --- Finance  ✅ COMPLETE

Fee structures and fee items, invoices (draft → issued → partially
paid → paid / void), manual payment recording and verification,
refunds, auto-generated receipts, balances and finance reports
(outstanding, summary, CSV export). Money is NUMERIC(12,2) transported
as strings and computed in integer cents. Parents/students are scoped
to their own/children's data on `/billing`; staff manage fees on
`/finance/fees` and invoices/payments on `/finance/invoices`. Payments
are recorded and verified manually this phase — the payment
gateway/webhook integration is deferred (`providerReference` and
`idempotencyKey` columns are reserved) and receipts are metadata-only
JSON (`objectKey` stays null); PDF receipts are deferred. See
`docs/API.md` Phase 8.

### Phase 9 --- Admissions  ✅ COMPLETE

Staff-intake applications (`applied → documents_submitted →
under_review → assessment_scheduled → assessed → accepted →
enrolled`, plus `waitlisted`/`rejected`/`withdrawn`), R2-backed
applicant documents with metadata in PostgreSQL (multipart upload,
authorized streaming download, 10 MB limit), entrance
assessments/interviews (schedule, score, result), review and
accept/reject/waitlist/withdraw decisions with notes, and a separate
two-step conversion: enroll an accepted/waitlisted application in one
transaction that creates the student (staff-supplied admission
number), the active enrollment and, optionally, a guardian parent
record. Numbers are `APP-YYYY-NNNN`; all routes are staff-only
(admin/super_admin permissions) and live on `/admissions`. The public,
unauthenticated application form is deferred to Phase 18, and R2
upload/download returns 503 under plain Node dev (use `npm run cf:dev`
or a deployed environment). See `docs/API.md` Phase 9.

### Phase 10 --- Communication/events  ✅ COMPLETE

Announcements (draft/scheduled/published/archived with audience
targeting and synchronous notification fan-out on publish — moved to
the async queue consumer in Phase 12 Part B), notifications
(per-recipient, list/mark-read/delete scoped to the authenticated
user), internal messages (send by email or user ID, inbox with
mark-read), events (CRUD with audience), and gallery (albums +
R2-backed images with multipart upload, authorized streaming
download, 25 MB limit). Queue producer bindings declared in
`wrangler.toml`; the consumer + `queue()` handler landed in Phase 12
Part B. Learning resources deferred (Phase 7 territory);
thumbnail/optimization pipeline deferred to Phase 12; public
events/gallery website deferred to Phase 18. Gallery upload/download
returns 503 under plain Node dev (use `npm run cf:dev`). See
`docs/API.md` Phase 10.

### Phase 11 --- Reports/audit  ✅ COMPLETE

Operational reports, exports and audit UI. Audit log viewer
(super_admin-only via `audit_logs.view`) with filter bar (action,
resource, user, dates, search), expandable rows showing `resourceId`
and pretty-printed `metadata`, and CSV export (gated by
`reports.export`). Reports overview endpoint (school-wide counts for
students/teachers/parents/staff/classes/sections/subjects, with
enrollments-by-status and announcements-by-status breakdowns and
upcoming/past event counts). Attendance per-class report (present/
absent/late/excused totals + rate) and enrollment per-class-by-status
report, both with CSV export. Student directory CSV export using the
previously-dormant `students.export` slug. Dashboard adds Reports +
Audit logs sections. Ten idempotent audit log seed rows cover typical
actions (auth.login.success, role.update, student.create/archive,
invoice.create, attendance.mark, payment.verify,
announcement.publish, admission.advance, user.update). No new
permissions or migrations. Delivered in Phase 12: row-level scoping for
teachers (Part A), queue consumer handler (Part B), PDF report cards
(Part C / Option A), xlsx exports + admissions-pipeline report + PDF
audit certificates (Part C / Option B), and on-Worker WASM gallery
image thumbnails (Part C / Option C). See `docs/API.md` Phase 11.

### Phase 12 --- Hardening  ✅ COMPLETE

Security, authorization, file security, rate limits, queues,
performance, accessibility and staging review.

**Part A --- Security & authorization hardening  ✅ COMPLETE**

- File-upload magic-byte content sniffing
  (`server/utils/uploads.ts`): `sniffMagicBytes` reads the leading bytes
  and `assertSniffMatchesDeclared` verifies the sniffed family is
  consistent with the declared MIME. Wired into `readUpload`
  (`server/utils/multipart.ts`) so all five upload routes
  (assignment attachments, submissions, gallery images, resources,
  admission documents) inherit it. A renamed EXE/PNG/etc. named `.pdf`
  with a matching declared type now returns 422. Recognised: PDF, PNG,
  JPEG, GIF, WebP, SVG, ZIP/OOXML, legacy Office OLE, MZ/ELF
  executables, plus a printable-text heuristic. Unknown content falls
  back to the existing declared-MIME + extension check.
- Shared business-actor resolver (`server/utils/auth/actor.ts`):
  `resolveActorProfile(event, staffPermission)` resolves the caller's
  teacherId / studentId / staffProfileId / parent's children, cached
  per request on `event.context.actorBusinessIds`. Does not touch the
  auth middleware hot path (`loadUserGrants` unchanged). Includes the
  pure `classifyActorScope` decision function and shared
  `studentEnrolledClassIds` / `teacherTaughtClassIds` helpers.
- Row-level scoping for timetable, attendance and exams lists
  (`server/services/schedule.ts`, `server/services/exams.ts`):
  teachers see only their own timetable entries and the classes they
  teach; students see their own enrolled classes; parents see their
  children's classes; staff (admins + callers holding the route's
  admin-only permission: `timetable.manage`, `attendance.approve`,
  `exams.create`) see everything. `attendanceClassReport` and
  `studentAttendance` gain 403 access checks for non-staff callers. A
  teacher passing a foreign `teacherId` is silently scoped to self.
- Tests: 26 new pure unit tests (18 sniff/compatibility +
  8 `classifyActorScope` branches). Suite 317/317 pass; typecheck
  clean; cloudflare-module build succeeds; `db:seed` idempotent.

**Part B --- Queue consumer + async notifications  ✅ COMPLETE**

- Announcement fan-out moved off the publish request:
  `publishAnnouncement` marks the row published, counts the audience
  recipients, and enqueues ONE `announcement.published` message on the
  `NOTIFICATION_QUEUE` producer (`server/services/communication.ts`,
  `server/utils/notifications-queue.ts`). The API contract
  (`{ announcement, notified }`) is unchanged; `notified` is the
  targeted recipient count.
- Consumer inside the same Worker: Nitro's cloudflare-module runtime
  already exports a `queue()` handler that emits the
  `cloudflare:queue` Nitro hook, so no custom Worker entry is needed.
  `server/plugins/cloudflare-queue.ts` handles the batch with a
  short-lived D1 client (`createWorkerD1Database` in
  `server/utils/db.ts`), ack on success, `message.retry()` on
  transient failure, ack of malformed poison messages.
- Dispatch logic in `server/services/notification-dispatch.ts`: zod
  message envelope, audience targeting (moved from communication.ts),
  recipient count, idempotent per-recipient insert, and the message
  router.
- Idempotency for at-least-once delivery: migration 0002 adds
  `notifications.announcement_id` + a partial unique index
  `(user_id, announcement_id) WHERE announcement_id IS NOT NULL`;
  the consumer INSERTs `ON CONFLICT … DO NOTHING`. Verified against
  local D1 (first delivery inserts rows; redelivery inserts 0). Plain
  Node dev has no queue binding, so fan-out runs inline.
- `wrangler.toml` declares `[[queues.consumers]]` for local, staging
  and production (`max_batch_size = 10`, `max_batch_timeout = 5`);
  `wrangler deploy --dry-run` passes.
- Tests: 17 new dispatch tests (envelope validation, audience SQL
  parameter binding, idempotent insert, stale/missing announcement,
  routing). Suite 334/334 pass; typecheck clean; build succeeds;
  migrations apply and `db:seed` is idempotent.

**Part C / Option A --- PDF report cards  ✅ COMPLETE**

- A PDF is rendered on report-card generate
  (`POST /api/v1/students/:id/report-cards`) and re-rendered on
  publish (`POST /api/v1/report-cards/:id/publish`), stored in R2
  under a stable key
  (`report-cards/<sessionId>/<termId>/<studentId>/<cardId>.pdf`), and
  the `report_cards.object_key` column is updated. No new migration,
  table column, or permission — the existing `object_key` column and
  `report_cards.view` permission are reused.
- New download endpoint `GET /api/v1/report-cards/:id/pdf` streams the
  stored PDF from R2 with `application/pdf` + an attachment filename.
  `requirePermission('report_cards.view')` +
  `getActor('report_cards.view')` + `getReportCard(id, actor)`
  enforces own/children + published-only access for non-staff callers
  (404 when missing, 403 when forbidden). A null `objectKey` returns
  404 ("Report card PDF has not been generated.").
- Rendering uses `pdf-lib` (pure JavaScript, Workers-compatible) in a
  pure function `renderReportCardPdf(card)` (`server/utils/pdf/report-card.ts`):
  A4 portrait, standard Helvetica fonts, header (school name +
  session/term), student block, subject results table (subject/total/
  max/pct/grade), per-subject score breakdown, totals row
  (total/average/overall grade), remarks (attendance/teacher/principal)
  and a status/date footer. Pages paginate automatically. Long subject
  names are truncated with an ellipsis; long remarks are word-wrapped.
- Plain Node dev (`nuxt dev`) has no `R2_BUCKET` binding, so
  `storeReportCardPdf` swallows the 503 from `putObject` and leaves
  `objectKey` null — generation/publish still succeed and return the
  card; the download endpoint returns 404. Use `npm run cf:dev` or
  staging/prod to actually store and serve PDFs.
- Tests: 15 new pure unit tests
  (`server/utils/pdf/__tests__/report-card.test.ts`) — object-key
  build/stability/character stripping; PDF magic header; single page
  for an empty card; header/student-block/totals/remarks rendering;
  empty subject state; subject table with scores + score breakdown;
  several table-only subjects on one page; pagination for 30 subjects;
  null optional fields; omission of absent sections; long-name
  truncation; long-remark wrapping. Text assertions inflate pdf-lib's
  FlateDecode streams and decode the `<hex> Tj` text operands so no
  extra text-extraction dependency is needed. Suite 349/349 pass;
  typecheck clean; cloudflare-module build succeeds.
- `putObject` (`server/utils/storage.ts`) was widened from
  `ArrayBuffer` to `ArrayBuffer | ArrayBufferView` so a `Uint8Array`
  can be passed directly (matches the underlying R2 binding signature).

Known limitations: standard Latin fonts only (Unicode font embedding
deferred); PDF storage requires the R2 binding; PDF regenerated only
on generate/publish (editing a published card's remarks without
re-publishing leaves a stale PDF).

**Part C / Option B --- xlsx exports, admissions pipeline, audit certificate  ✅ COMPLETE**

- The five existing CSV exports
  (`reports/attendance`, `reports/enrollments`, `audit-logs`,
  `students`, `finance/outstanding`) now accept
  `?format=json|csv|xlsx` through a shared edge-safe helper
  (`server/utils/exports.ts`): RFC-4180 CSV (single implementation —
  the five routes had diverged), and xlsx via `write-excel-file`'s
  **universal** subpath with fflate bundled inline (no Node built-ins,
  no Web Workers; verified in the Worker bundle). Bold header row;
  NUMERIC money/score values stay text cells to preserve precision.
  Unknown `format` values now `422` instead of silently returning JSON.
- New exam score sheet: `GET /api/v1/exams/:id?format=xlsx`
  (`getExamScoresForExport`, xlsx only — other formats 422), columns
  admission number/student/subject code/name/max/score/grade, gated by
  `exams.view` + `reports.export`.
- New `GET /api/v1/reports/admissions` pipeline report (json/csv/xlsx):
  per-stage counts in workflow order with zero-fill for all 11
  admission statuses, optional session/class filters, trailing Total
  row in file formats; gated by `admissions.view` + `reports.export`.
- New `GET /api/v1/reports/audit-certificate` streams an on-demand A4
  PDF (`pdf-lib`, pure `renderAuditCertificatePdf`) over audit-log
  aggregates: actor + generation time, exact filter scope,
  total/earliest/latest, paginated per-action breakdown table,
  append-only statement and reference. Gated by `audit_logs.view` +
  `reports.export`; not persisted to R2. No migrations or new
  permission slugs.
- Tests: 20 new — export util (CSV escaping, format validation, xlsx
  round-trip with `read-excel-file/node`, decimal strings kept as
  text), pipeline ordering/zero-fill/enum coverage, and 8 certificate
  PDF tests (stream-inflate/hex-decode assertions, pagination). Suite
  369/369 pass; typecheck clean; build succeeds; `wrangler deploy
  --dry-run` ok (xlsx chunk contains zero `node:` specifiers);
  `db:seed` idempotent.

Part B does NOT add email delivery yet — queue messages create in-app
notification rows only; an email provider integration remains future
work.

**Part C / Option C --- gallery image thumbnails  ✅ COMPLETE**

- JPEG/PNG/WebP gallery uploads are decoded, width-capped and
  re-encoded **on the Worker** with `@jsquash` WASM codecs (mozjpeg,
  squoosh PNG, libwebp, squoosh resize): 480 px max width, lanczos3,
  JPEG quality 82; images already at/under the cap are never
  upscaled. GIF (animation) and SVG (resolution-independent) are
  deliberately not thumbnailed; source dimensions are capped at
  10,000 px to bound WASM memory/CPU.
- The codecs (~1 MB raw wasm) are base64-inlined into five lazily
  dynamic-imported chunks by a custom Rollup/Vite plugin
  (`build/jsquash-wasm-loader.ts`, also wired into Vitest with
  `test.server.deps.inline` for `@jsquash`) — no wrangler wasm rules,
  external image service, or Cloudflare Images binding.
- Eager best-effort generation at multipart upload; the thumb is
  stored in R2 at a deterministic key (`<objectKey>.thumb.jpg`) in the
  pre-existing nullable `thumb_object_key` column — no migration.
  Failures leave the key null and never block the upload.
- New `GET /api/v1/gallery/albums/:id/images/:imageId/thumbnail`
  (`gallery.view`): inline JPEG with
  `private, max-age=31536000, immutable`; lazy backfill on first view
  for legacy/failed rows; one regeneration attempt if the advertised
  R2 object is missing; `404` otherwise so the gallery grid falls
  back per-image to the original URL. Thumbs are deleted with their
  image and on album deletion. No new permission slugs.
- Tests: 9 new
  (`server/utils/images/__tests__/thumbnail.test.ts`) run the real
  WASM — PNG/JPEG/WebP downscale round-trips, aspect-ratio-preserving
  custom widths, no-op for small sources, null for unsupported/
  corrupt/empty input, deterministic key helper. Suite 378/378 pass;
  typecheck clean; build succeeds; `wrangler deploy --dry-run` ok
  (codec chunks contain zero `node:` specifiers and no unresolved
  imports); `db:seed` idempotent.

Known limitations: GIF/SVG show the original (no thumb); plain Node
`nuxt dev` has no R2 binding so generation needs `npm run cf:dev` or
staging/prod (upload still succeeds with a null key); supported-image
uploads now include bounded WASM processing time.

Remaining Phase 12 workstreams deferred:

- Shared KV/Durable-Object rate limiter and server-side session
  revocation list (infra-dependent; candidate for Phase 13).
- Performance, accessibility and staging review.

See `docs/API.md` Phase 12 (Parts A–C / Options A–C).

### Phase 13 --- Production readiness  (roadmap approved 2026-09-20; NOT STARTED)

Cloudflare Workers, TLS/WAF, D1, R2, Queues, Cron Triggers, backups,
monitoring, deployment and rollback. PostgreSQL/Neon/Hyperdrive were
decommissioned 2026-09-24 — D1 is the sole database engine, so this
phase is now a pure D1 + DNS + TLS + backups cutover.

- [pending] Provision the staging D1 database (`wrangler d1 create
  sms-staging`), put the returned id into `wrangler.toml`, apply
  migrations remotely (`wrangler d1 migrations apply DB -e staging
  --remote`), and seed. Provision R2 bucket `sms-staging`, Queue
  `sms-notifications-staging`, and `SESSION_SECRET` on Worker
  `sms-staging`.
- [pending] Real D1 database ids in `wrangler.toml` staging/production
  blocks (both placeholders until the cutover); queue producer/consumer
  declarations live; R2 lifecycle rules and Cron Triggers still to add.
- Manual `npm run deploy:staging`; TLS/WAF on the real domain; stable
  `SESSION_SECRET` (wrangler secret); never place secrets in
  `wrangler.toml`.
- Shared KV/Durable-Object rate limiter and server-side session
  revocation list (carried over from Phase 12 deferred workstreams).
- Backups, monitoring/alerting, and a verified deploy + rollback drill.

Exit criteria: staging reachable with D1/R2, full test suite green,
demo seed data only (never real student data), deploy/rollback verified.
Do not start Phase 14 without explicit project-owner go-ahead.

### Phase 14 --- SMS completion: admin foundation  (roadmap 2026-09-20; NOT STARTED)

Closes the authenticated-SMS gaps in the product spec (admin
dashboard) and stores school identity/branding as **data** — never
hard-coded.

- User account, role and permission administration
  (`GET/POST/PUT /api/v1/users`, role assignment, permission
  management + admin UI; today roles exist only in the database/seed).
- School settings module and UI: school name, motto, address/location,
  email, phone, logo, brand colors, and bank details (bank name,
  account number, account name). All downstream documents/templates
  read from settings.
- Documents module (staff document management, R2-backed, authorized
  streaming, no public bucket URLs).
- Inventory module (books/equipment ledger).
- Expanded financial reports (per fee purpose, per class, per term).

### Phase 15 --- Payments: Paystack + QR codes  (roadmap 2026-09-20; NOT STARTED)

- Paystack integration: initialize → checkout → verify → signed,
  idempotent webhook; use the already-anticipated
  `provider_reference`/`idempotency_key` fields. No trust of
  client-supplied payment status.
- Branded PDF receipts generated server-side, with bank details
  sourced from School Settings.
- QR codes: static office QR (bank details) plus a dynamic QR per
  student/invoice carrying the payment reference; shown in the parent
  portal and on receipts.
- Surface fee purposes (tuition, sports, excursion, library, etc.) in
  the UI; they remain configurable data, never hard-coded.

### Phase 16 --- Dedicated role portals  (roadmap 2026-09-20; NOT STARTED)

Reuses the existing APIs; primarily new frontend plus the few missing
modules.

- Role-split portal shells: `/portal/student`, `/portal/parent`,
  `/portal/teacher`.
- Student: dashboard (current class, timetable, upcoming assignment
  deadlines, recent grades, attendance), learning resources, and
  online registration/enrollment.
- Parent: child switcher, termly + cumulative progress, attendance
  dashboard, fees (outstanding balance, history, Paystack checkout,
  QR, bank details), report-card PDF download, and a "message my
  child's teacher" flow over the existing messaging API.
- Teacher: class dashboard, checkbox attendance recorder, bulk **CSV**
  score upload (parse → validate → preview → commit), lesson-note
  management (new table + CRUD), performance tracking, and grade
  submission → report-card generation.

### Phase 17 --- Communication channels  (roadmap 2026-09-20; NOT STARTED)

- Wire the existing `email.send` queue message kind to a real email
  provider (e.g. Resend): announcement, fee-reminder and
  result-published templates.
- Nigerian SMS gateway (e.g. Termii) for urgent notices.
- Newsletter subscription storage and per-user notification
  preferences.
- Scheduled digest via Cron Triggers.

### Phase 18 --- Public website  (renumbered from the old Phase 14 stub; roadmap 2026-09-20; NOT STARTED)

Only after the SMS is stable and production-ready. Delivers all
public-facing sections of the product spec.

- Design system driven by School Settings: primary blue `#1a237e`,
  gold `#C9A84C`, red `#B22234`, cream background `#F8F4E8`, dark text
  `#1a1a2e`; the "VICTORIOUS / CHILDREN SCHOOL / OJODU • LAGOS"
  lockup with the italic tagline "Not to Equal, But to Excel".
- Homepage: hero with name/motto/location, image carousel or
  background video, quick actions (Apply Now, Pay Fees, Check Results,
  Student Portal), school statistics, "Why Victorious Children
  School", latest news/announcements, quick links, footer with
  contact/bank details/social links.
- About: history/founding story, vision/mission/core values,
  philosophy, staff profiles and leadership, photo gallery.
- Public admissions: rate-limit + bot-protect the public multi-step
  application wizard; admission status checker by application ID;
  downloadable PDF forms and prospectus generated from settings.
- Academics: Nigerian curriculum overview, Primary (Grades 1–6) and
  Secondary (JSS 1 – SSS 3) sections with per-class subject lists,
  academic calendar, examination schedules.
- Public result checker (student ID + term; published results only;
  rate-limited).
- Activities: public photo/video gallery, sports/clubs, events
  calendar, achievements/awards.
- Public news/blog and notice board with filtered calendar.
- Contact: Google Maps embed, department-routed contact form, phone/
  email/emergency contacts, FAQ, complaints/suggestions form.

Public endpoints must not expose private files, real student data, or
unpublished results.

### Phase 19 --- Launch  (roadmap 2026-09-20; NOT STARTED)

- Real content population; privacy review of every public endpoint.
- WAF/rate-limit rules; DNS split between public site and
  authenticated portal (see §4); staging soak; go-live plus rollback.

All phases keep the standing rules: zod validation, server-side
authorization, Vitest coverage, `docs/API.md` + README updates, and
manual Wrangler deploys only (no GitHub Actions/Pages Git/Workers
Builds).

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
4.  D1 is the sole database engine (PostgreSQL/Neon/Hyperdrive
    decommissioned 2026-09-24 — see §52).
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
Runtime        Cloudflare Workers + Static Assets (cloudflare-module preset)
Database       Cloudflare D1 (SQLite) — sole engine in every environment
               (PostgreSQL/Neon/Hyperdrive decommissioned 2026-09-24)
ORM            Drizzle (SQLite dialect)
Validation     zod (shared schemas)
Background     Cloudflare Queues + Cron Triggers (from Phase 10)
Storage        Cloudflare R2 (R2_BUCKET binding only)
Edge           Cloudflare DNS / TLS / WAF / rate limiting
Source control GitHub (version history only; no Git-driven deployments)
Deployment     Manual Wrangler from the local Mac (wrangler deploy -e …)
IDE            TRAE CN
Dev env        Local Node 24 + local D1 (Miniflare via wrangler.toml; no
               external database server, no DATABASE_URL)
Mac            development + deployment machine (Node 24, npm, Wrangler)
Staging        Worker sms-staging + sms-staging R2 + sms-staging D1
               (D1 id placeholder until the staging cutover; first deploy
               pending the staging acceptance checkpoint)
Production     Worker sms-production + sms-production R2 + sms-production D1
               (not provisioned until staging is accepted)
Website        deferred
Current phase  Phase 12 Parts A–C / Options A–C ✅ COMPLETE (Phases 0–11
               done; Part A security/auth hardening: file magic-byte
               sniffing + timetable/attendance/exams row-level scoping;
               Part B queue consumer + async idempotent announcement
               fan-out; Part C Option A PDF report cards with R2
               storage + authorized download; Part C Option B xlsx
               exports, admissions-pipeline report and on-demand PDF
               audit certificates; Part C Option C on-Worker WASM
               gallery image thumbnails; email delivery, payment
               gateway/webhook still deferred).
```

**This document is the authoritative implementation guide for TRAE.**

## 47. Architecture migration status

The project has **approved the migration** from the previously planned
Vue 3 + Laravel 12 architecture to **Nuxt 4 + Cloudflare Workers**,
with **Cloudflare D1** as the sole database engine
(PostgreSQL/Neon/Hyperdrive decommissioned 2026-09-24).

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
-   D1 is now primary (per v2.0 spec, 2026-09-21; see §52). Historical
    academic records and durable, auditable financial records remain
    mandatory and are preserved through the PG→D1 migration.
-   The public school website is sequenced as Phase 18 in the approved
    2026-09-20 roadmap and remains deferred until the SMS is stable and
    production-ready.
-   Current phase: **Phases 0–12 ✅ COMPLETE; Phase 13 — Production
    readiness NOT STARTED (awaiting project-owner go-ahead)**.
    The approved forward roadmap (2026-09-20) is: Phase 13 production
    readiness; Phase 14 admin foundation (users/roles, school settings,
    documents, inventory, financial reports); Phase 15 Paystack + QR
    payments; Phase 16 dedicated student/parent/teacher portals;
    Phase 17 email/SMS communication channels; Phase 18 public website;
    Phase 19 launch. Payment gateway/webhook remain deferred to
    Phase 15.

## 48. Architecture decision (summary)

**Previous direction:** Vue 3 + Vite frontend, Laravel 12 API,
PostgreSQL, Redis, Cloudflare R2/edge.

**Approved direction:** Nuxt 4 + TypeScript + Vue 3 + Nitro on
Cloudflare Workers, Cloudflare D1 (SQLite), R2, Queues.

**Reason (evidence-based):** single TypeScript stack for client and
server; reduced infrastructure and operational overhead (no PHP/Redis
servers, no external database server); native Cloudflare compute,
scaling and generous free tier; D1 gives binding-managed local/remote
databases with no connection-string management; the backend had not yet
been built, so the move was low-risk. Weighted score: Nuxt option 8.75
vs Laravel option 7.60.

## 49. Documentation hierarchy

1.  **Primary source of truth:** this `README.md`.
2.  **Canonical migration spec:** the `docs/spec/v2/` package (placed
    2026-09-21) — the directive for the D1 migration.
3.  Operational docs live in `docs/`; hard rules live in
    `PROJECT_RULES.md`.
4.  The PG-era decision records (`ARCHITECTURE_FEASIBILITY_ASSESSMENT.md`,
    `ARCHITECTURE_DECISION_RECORD.md`, `MIGRATION_PLAN.md`,
    `MIGRATION_GAP_REPORT.md`) were deleted 2026-09-24 as part of the
    PostgreSQL/Neon/Hyperdrive decommission; they remain recoverable
    from git history.

A future significant architecture change requires updating this README
and creating/updating an Architecture Decision Record — never a
competing README.

## 50. Migration plan reference

Migration is incremental and sequential. Existing work must be
preserved; each phase must pass its tests and quality gate before the
next begins; destructive changes require explicit approval. The
PG→D1 migration is complete (PostgreSQL/Neon/Hyperdrive decommissioned
2026-09-24); see §52 for the migration status and the §51 change log
for the full history.

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
2026-09-12  Infra   Deployment model migrated from Cloudflare Pages
                    (cloudflare-pages) to Cloudflare Workers + Static
                    Assets (Nitro cloudflare-module). New app/wrangler.toml
                    with main/.output/server, [assets] ASSETS binding and
                    staging/production named environments (own Hyperdrive
                    ids + R2 buckets); old Pages config preserved as
                    app/wrangler.pages.toml (git rename). DB client now
                    initialises from the HYPERDRIVE binding per isolate
                    (server/plugins/cloudflare.ts, binding-aware lazy
                    db.ts; DATABASE_URL retained for local Node dev);
                    unused R2 S3 key/secret config removed; manual-only
                    deploys via npm run deploy:staging|production; no
                    Git/Workers-Builds/Actions deployment. Verified:
                    143 tests, type-check, cloudflare-module build and
                    wrangler deploy --dry-run for both environments pass.
2026-09-13  Infra   Pre-Phase-7 Cloudflare staging acceptance checkpoint:
                    Codespaces/CI retired (.devcontainer/,
                    .github/workflows/ci.yml, docs/CODESPACES.md removed;
                    history preserved in Git). PROJECT_RULES, TRAE rules,
                    README §29-§34/§39/§46, docs/ARCHITECTURE/DATABASE/
                    CLOUDFLARE/SECURITY/TESTING rewritten for local
                    development + manual Wrangler deployment; observability
                    (wrangler tail/deployments) and manual rollback
                    (wrangler rollback) documented; .dev.vars/.wrangler
                    added to .gitignore. Gates: 143 tests, type-check,
                    cloudflare-module build pass; nuxt dev verified
                    (health degraded-without-DB as designed, login 200,
                    protected API 401). Blocked on owner action before
                    real staging deploy: managed PostgreSQL decision +
                    Hyperdrive/R2 provisioning (token missing r2 scope;
                    re-login may be required) + wrangler secrets.
2026-09-13  Phase 8 Finance: fee structures + fee items, invoices
                    (draft/issued/partially paid/paid/void), manual
                    payment record/verify/refund with overpayment guard,
                    auto-generated receipts, balances and outstanding/
                    summary reports with CSV export; NUMERIC money on
                    the wire with integer-cents shared helpers
                    (shared/utils/money.ts); shared zod schemas + types;
                    finance service with parent/student scoping and
                    year-based INV-/PAY-/RCT- numbering in transactions;
                    21 RBAC/audited Nitro routes; typed finance client
                    service; staff /finance/fees and
                    /finance/invoices pages plus parent/student /billing
                    and dashboard links; idempotent fake finance seeding
                    (structure, partially paid invoice, verified cash
                    payment, receipt); docs/API + ARCHITECTURE updated;
                    payment gateway/webhook and PDF receipts deferred.
2026-09-13  Phase 9 Admissions: staff-only application pipeline
                    (applied/documents/under review/assessment/
                    accepted/waitlisted/rejected/withdrawn/enrolled)
                    with APP-YYYY-NNNN transactional numbering,
                    multipart R2 document upload + authorized streaming
                    download/delete (10 MB category, PG metadata,
                    orphan cleanup), assessments/interviews with derived
                    statuses, review and decision actions with notes
                    and transition guards, and one-transaction
                    accepted/waitlisted -> student + enrollment
                    conversion with optional guardian parent; shared
                    zod schemas + types; 16 RBAC/audited Nitro routes;
                    typed admissions client service; /admissions page
                    and dashboard card; five fake seeded applications
                    (one historical enrolled conversion); docs/API +
                    ARCHITECTURE updated; public application form
                    deferred to Phase 14.
2026-09-16  Phase 10 Communication/events: announcements
                    (draft/scheduled/published/archived with audience
                    targeting and synchronous notification fan-out on
                    publish), notifications (per-recipient,
                    list/mark-read/delete scoped to authenticated
                    user), internal messages (send by email or user
                    ID, inbox with mark-read), events (CRUD with
                    audience), gallery albums + R2-backed images
                    (multipart upload, authorized streaming
                    download, 25 MB category); queue producer
                    bindings declared in wrangler.toml for future
                    async email; shared zod schemas + types; 28
                    RBAC/audited Nitro routes; typed communication +
                    events client services; /announcements,
                    /notifications, /messages, /events and /gallery
                    pages plus dashboard sections; four new
                    permissions (events.view/manage,
                    gallery.view/manage); idempotent fake seeding
                    (4 announcements, 5 notifications, 3 messages, 3
                    events, 2 albums with placeholder images);
                    docs/API + ARCHITECTURE updated; learning
                    resources, thumbnail pipeline and public
                    events/gallery website deferred.
2026-09-16  Phase 11 Reports/audit: audit log viewer
                    (super_admin-only via audit_logs.view) with
                    filter bar and CSV export (reports.export);
                    reports overview (school-wide counts for
                    students/teachers/parents/staff/classes/sections/
                    subjects plus enrollments-by-status and
                    announcements-by-status breakdowns and
                    upcoming/past event counts); attendance per-class
                    report and enrollment per-class-by-status report,
                    both with CSV export; student directory CSV export
                    using the previously-dormant students.export slug;
                    /reports and /audit-logs pages plus dashboard
                    sections; ten idempotent audit log seed rows;
                    shared zod schemas + types; 5 RBAC Nitro routes
                    (4 new + 1 modified); no new permissions or
                    migrations; docs/API + ARCHITECTURE updated; PDF
                    report cards/PDF audit certificates, Excel/.xlsx
                    exports, admissions-pipeline report, row-level
                    scoping for teachers, queue consumer handler
                    deferred to Phase 12.
2026-09-20  Roadmap Forward plan approved and recorded (Phases
                    13–19); no code changes. Phase 13 production
                    readiness; Phase 14 SMS admin foundation
                    (users/roles, school settings with school identity
                    + bank details as data, documents, inventory,
                    financial reports); Phase 15 Paystack + QR
                    payments + branded PDF receipts; Phase 16
                    dedicated student/parent/teacher portals (incl.
                    CSV score upload, lesson notes); Phase 17 email/
                    SMS channels + newsletter; Phase 18 public website
                    (renumbered from the former Phase 14 stub; covers
                    homepage, about, public admissions wizard + status
                    checker, academics, public result checker,
                    activities, news, contact, with brand colors
                    #1a237e/#C9A84C/#B22234/#F8F4E8 and logo lockup);
                    Phase 19 launch. Phase 13 not started — awaiting
                    explicit project-owner go-ahead.
2026-09-20  Phase 13 (partial) Staging cutover LIVE: managed PostgreSQL
                    provisioned on Neon free tier (db sms_staging,
                    Postgres 18.6, DIRECT host ep-calm-shape-…c-6.
                    us-east-2 — not the -pooler endpoint); schema reset
                    note: drizzle journals migrations in a separate
                    "drizzle" schema, so a full DB reset must drop
                    both public and drizzle. Cloudflare resources:
                    Hyperdrive config sms-pg-staging
                    (f9399aef-…, caching DISABLED for read-after-write),
                    R2 bucket sms-staging (no r2.dev public access),
                    Queue sms-notifications-staging (producer+consumer
                    wired by deploy), SESSION_SECRET wrangler secret;
                    migrations + synthetic seed applied from the Mac via
                    the direct URL. Worker sms-staging deployed
                    (https://sms-staging.victoriouschildrenschool1.
                    workers.dev): health database=true, login 200 and
                    /auth/me returns admin role/permissions.
                    Critical runtime fix: PBKDF2 iteration count lowered
                    210000 -> 100000 because deployed Cloudflare Workers
                    WebCrypto rejects PBKDF2 above 100k (verify swallowed
                    the error as failed login; Node dev and local
                    workerd do not enforce it, so only production
                    diagnosis exposed it); test updated to pin 100000;
                    all 378 tests pass, type-check clean. Production not
                    provisioned — pending staging acceptance.
2026-09-20  Security Secret-leak hardening: app/.env DATABASE_URL had
                    been pointed at the staging Neon URL, and Nuxt
                    serialized the build-time process.env values in
                    runtimeConfig INTO the Worker bundle — the Neon
                    password and local SESSION_SECRET were present in
                    deployed script versions. Fix: nuxt.config.ts now
                    ships EMPTY runtimeConfig defaults; new Nitro
                    'request' hook in server/plugins/cloudflare.ts
                    bridges SESSION_SECRET/DATABASE_URL/
                    EXPOSE_RESET_TOKENS per request from Cloudflare
                    bindings (Workers) or process.env/app/.env (Node
                    dev). Verified on staging: config secret == binding
                    secret, databaseUrl empty, 318 bundle chunks contain
                    no secrets, 378 tests + type-check pass, login/
                    auth/me 200. Root .env.example is now a comment-only
                    pointer (no KEY=VALUE); app/.env.example documents
                    STAGING_DATABASE_URL with placeholders. ACTION FOR
                    OWNER: rotate the Neon staging password (it existed
                    in older Worker bundles), update app/.env and
                    `wrangler hyperdrive update sms-pg-staging
                    --connection-string=…`; local SESSION_SECRET already
                    rotated.
2026-09-21  Phase 0 (D1) Project owner approved the v2.0 D1 spec package
                    ( Victorious_Children_School_Cloudflare_D1_AI_Package/
                    → docs/spec/v2/). POLICY REVERSAL: D1 is now the
                    authoritative database; PostgreSQL/Neon/Hyperdrive
                    will be decommissioned ONLY after a D1 staging
                    deployment passes acceptance. The live PG-backed
                    staging Worker remains as fallback until then.
                    Type conventions: money = INTEGER kobo (₦150,000 =
                    15,000,000); scores/weights/boundaries = INTEGER
                    fixed-point ×100; timestamps TEXT ISO-8601 UTC;
                    dates YYYY-MM-DD; times HH:MM:SS; IDs TEXT
                    app-generated UUIDs; enums TEXT+CHECK. RBAC stays
                    5-table (104 slugs); sessions stay stateless signed
                    cookies + KV revocation. Phase 0 deliverable
                    MIGRATION_GAP_REPORT.md approved at repo root.
2026-09-22  Safety   Pre-D1 safety checkpoint: restored master README
                    (had been overwritten with the package README),
                    restored ADR+feasibility docs (still referenced by
                    PROJECT_RULES), placed the 7 canonical v2.0 specs +
                    TRAE_STRICT_COMPLIANCE_PROMPT under docs/spec/v2/,
                    untracked .DS_Store, committed pending Phase 14A
                    school-settings work and Phase 13 API doc updates.
                    Tagged pre-d1 on the last pre-migration commit and
                    branched feat/d1-migration for the in-progress
                    migration work. No destructive Hyperdrive/PG removal
                    yet — that starts only after Phase 1 (config-only
                    D1 binding addition with Hyperdrive kept as
                    fallback) is itself accepted.
2026-09-22  Phase 1  D1 architecture reset (config only, no behavior
                    deletion): added [[d1_databases]] binding `DB`
                    blocks to app/wrangler.toml (top-level local + env.
                    staging + env.production) alongside the existing
                    [[hyperdrive]] blocks (kept as fallback until
                    Phase 6). db.ts gained a Drizzle D1 driver path
                    (drizzle-orm/d1, structural D1Database type to
                    avoid @cloudflare/workers-types direct dep),
                    createWorkerD1Database() helper, getRequestD1Client
                    per-request holder, closeRequestDatabase no-op for
                    D1, and an SMS_USE_D1 env-var dispatch switch
                    (false in Phase 1 — Hyperdrive still serves live
                    staging). Queue consumer + publish-scheduled-
                    announcements cron got D1 fallback when HYPERDRIVE
                    is absent and env.DB is present (inert until
                    Phase 2). app/.env.example documents the SMS_USE_D1
                    switch and flags DATABASE_URL/STAGING_DATABASE_URL
                    as legacy fallback. PROJECT_RULES flipped to
                    D1-authoritative with PG-fallback. README §1, §12, §45, §48, §52 updated for D1. Behavior of the
                    live staging Worker is UNCHANGED — Hyperdrive
                    primary, D1 path inert.
2026-09-22  Phase 2  Schema rewrite PG → SQLite/D1 (no runtime flip;
                    Hyperdrive still serves live staging). drizzle.config.ts
                    dialect switched postgresql → sqlite; legacy PG config
                    retained as drizzle.pg.config.ts; the 4 PG migrations were
                    git-mv archived under database/migrations/legacy-pg/ and
                    the first D1 migration (0000_overrated_marvel_apes.sql,
                    52 tables + indexes + FKs, 125 DDL commands) was generated
                    into database/migrations/. package.json gained db:d1:migrate
                    / db:d1:execute / db:d1:seed; db:migrate|push|studio|seed
                    alias the PG legacy tooling. wrangler.toml D1 blocks gained
                    migrations_dir = "database/migrations" (local + staging +
                    production). All 12 schema files converted: pgTable →
                    sqliteTable; uuid defaultRandom → TEXT primary key with
                    $defaultFn(crypto.randomUUID()); varchar → text;
                    timestamp/date/time → plain TEXT (ISO-8601 / YYYY-MM-DD /
                    HH:MM:SS, no text({mode:'date'})); boolean → INTEGER 0/1;
                    numeric(12,2) money → INTEGER kobo; numeric(7,2) scores/
                    weights/boundaries → INTEGER ×100 fixed-point; bigint →
                    INTEGER. 16 pgEnums replaced by a sqliteEnum() shim
                    (text + CHECK) that preserves the genderEnum('gender')
                    calling convention, the literal-union column type and a
                    pgEnum-compatible .enumValues array. Partial unique index
                    (notifications user+announcement) preserved via
                    .where(sql`announcement_id IS NOT NULL`). 5-table RBAC
                    shape unchanged (D3); no sessions table (D4).
                    Seeder: new database/seed-d1.ts runs the idempotent demo
                    catalog against local D1 via getPlatformProxy; seeds/index.ts
                    is now D1-native (DrizzleD1Database, ISO timestamps, kobo
                    amounts, ×100 scores) and bulk inserts are chunked to
                    respect D1's 100-bind-variable limit; seed.ts kept as a
                    marked PG-legacy fallback (@ts-expect-error; Phase 6).
                    Service layer is now TYPE-CHECKED against D1: AppDatabase
                    (SmsDb alias) resolves to DrizzleD1Database<Schema> with two
                    narrow, TODO-tagged shims — interactive .transaction()
                    (17 sites) and PG-style .execute() (4 raw-SQL sites) — both
                    removed in Phase 3. ~108 database-bound Date values were
                    adapted to ISO strings (runtime-safe: PG implicitly casts
                    ISO text; same instants preserved). Finance kobo adaptation
                    is deliberately DEFERRED to Phase 4b (33 @ts-expect-error
                    markers; converting while PG is live would corrupt amounts)
                    and ×100 score adaptation to Phase 3 (15 markers); PG SQL
                    strings (40 ilike, ::int, FILTER, array_agg, interval) left
                    intact for the Phase 3 dialect migration. Health check moved
                    from PG-only db.$client to db.execute(sql`SELECT 1`).
                    Gates: nuxt typecheck EXIT 0 (0 errors), vitest 413/413
                    across 31 files, nuxt build (cloudflare-module) EXIT 0;
                    `wrangler d1 migrations apply DB --local` applied all 125
                    commands; `npm run db:d1:seed` populated local D1
                    (104 permissions, 5 roles, demo people/academics/finance/
                    exams/communication rows; verified ₦50,000 → 5,000,000
                    kobo, 100.00 → 10,000 and grade-A boundary → 7,000) and a
                    second run proved idempotency. No cloud resources created;
                    staging/production untouched; SMS_USE_D1 stays false.
2026-09-23  Phase 3  Query-dialect migration PG → D1 (RUNTIME FLIP: the
                    application is now D1/SQLite-only; rollback to PG is a
                    redeploy of the previous commit until Phase 6). LIKE:
                    33 ilike → like across people, academic-structure,
                    reports, events, communication, admissions (people's local
                    helper renamed likePattern to avoid colliding with
                    drizzle's like()). Raw SQL de-Postgresified: count(*)::int
                    → cast(count(*) as integer) (incl. five late-found sites
                    in events.ts), FILTER (WHERE …) → sum(case when …),
                    array_agg → group_concat with GrantRow
                    string|null + splitSlugs() in auth/context.ts,
                    array_position → CASE, "= ANY(ARRAY[…])" → IN, PG casts
                    removed, report dates bound as ISO strings, name search
                    uses trim(a || ' ' || b); notification fan-out uses
                    client.get/client.run(sql`INSERT … SELECT … ON CONFLICT …
                    DO NOTHING`) and meta.changes; health uses db.get.
                    All 17 interactive transactions converted to drizzle
                    db.batch() behind a runBatch(db, items) helper
                    (D1BatchStatements/D1BatchItem types in pagination.ts
                    because drizzle 0.39 types batch() as a non-empty readonly
                    tuple; the thenable insert-builder needs an explicit cast
                    when returned from a function, e.g. finance
                    receiptInsert): pre-reads + application-generated UUIDs
                    replace in-transaction reads (academic-structure slug
                    pre-compute, admissions enrollApplication, communication
                    publish, exams grading scales, finance fee structures/
                    invoices/payments/refunds); admissions keeps a 5-attempt
                    application-number retry. isUniqueViolation/
                    isForeignKeyViolation now recognise PG 23505/23503 AND
                    SQLite 2067/787. db.ts rewritten to drizzle-orm/d1 only:
                    lazy forwarding db proxy resolving the per-request/event
                    D1 binding in Workers, process-wide client in plain Node
                    dev via wrangler getPlatformProxy({persist:true})
                    (cached; closeNodeDatabase on Nitro shutdown);
                    plugins/cloudflare.ts guards on
                    navigator.userAgent==='Cloudflare-Workers'. The
                    Node-only wrangler import is assembled at runtime
                    (String.fromCharCode + @vite-ignore) — Rollup folds
                    plain string constants and Nitro auto-externalizes
                    wrangler, both of which make wrangler's own esbuild
                    pass try to bundle its CLI; do NOT add wrangler to
                    rollupConfig.external. Queue consumer and cron task use
                    createWorkerD1Database(env.DB). ×100 fixed-point scores
                    fully adapted in exams.ts (toScore100/fromScore100
                    across every write/DTO path; aggregates accumulate
                    integers; report cards persist integer total/average);
                    chunkRows() (pagination.ts) splits bulk writes to
                    respect D1's 100-bind-variable/100-statement limits
                    (bulk scores, grading-scale/fee/invoice items,
                    attendance). Gates: nuxt typecheck EXIT 0, vitest
                    413/413 across 31 files, nuxt build (cloudflare-module)
                    EXIT 0 with no wrangler code in the Worker bundle;
                    local D1 smoke on wrangler dev (migrations applied,
                    db:d1:seed idempotent, 55 tables): health
                    database:true, login/RBAC (group_concat permissions),
                    LIKE class search, grading-scale ×100 DTOs, and a
                    db.batch class create verified end-to-end (row cleaned
                    up afterward); `nuxt dev` (Node + getPlatformProxy)
                    verified the same. Intentionally retained until
                    Phase 6: postgres dependency, Hyperdrive binding,
                    database/seed.ts, legacy-pg migrations; the 33
                    @ts-expect-error Phase 4b kobo markers stay until
                    Phase 4b. No remote D1 provisioned; staging/production
                    untouched.
2026-09-23  Phase 4b Finance kobo migration (end-to-end INTEGER kobo;
                    the naira-string bridge is gone). Money is now
                    INTEGER kobo at every layer: zod schema → service →
                    D1 → DTO → UI display. shared/utils/money.ts
                    rewritten: parseNairaToKobo / koboToNaira / sumKobo /
                    multiplyKobo / formatMoney (kobo ÷ 100 → currency);
                    the toCents / fromCents / sumMoney / subtractMoney /
                    multiplyMoney naira-string helpers were deleted.
                    shared/schemas/common.ts added koboSchema =
                    z.number().int().min(0); shared/schemas/finance.ts
                    swapped the 7 money fields (fee item amount, manual
                    invoice unitAmount, invoice discount/tax, payment
                    amount) from positiveMoneySchema / nonNegativeMoneySchema
                    (string regex) to positiveKoboSchema / nonNegativeKoboSchema
                    (integer ≥ 0 / ≥ 1, capped at ₦99,999,999.99).
                    shared/types/index.ts changed every money field
                    string → number (FeeItem.amount; InvoiceItem.
                    unitAmount/lineTotal; Invoice.subtotal/discount/tax/
                    total/amountPaid/balance; InvoicePaymentSummary.amount;
                    Payment.amount; OutstandingRow.total/amountPaid/balance;
                    FinanceSummary.totalInvoiced/totalCollected/totalRefunded/
                    totalOutstanding + paymentsByMethod[].total).
                    server/services/finance.ts: all 33 Phase 4b
                    @ts-expect-error markers removed; the toCents/
                    fromCents/sumMoney/multiplyMoney bridge is gone;
                    recordPayment/verifyPayment/refundPayment now do
                    integer kobo arithmetic directly (amountKobo = input.amount;
                    amountPaidKobo = invoice.amountPaid + amountKobo;
                    newBalanceKobo = invoice.total - amountPaidKobo);
                    invoiceTotals returns {subtotal, total} as kobo
                    integers (totalCents field dropped); isInvoiceOverdue
                    + invoicePaymentStatus renamed their *Cents params
                    to *Kobo; financeSummary's four sum() casts flipped
                    from `as text` to `as integer` with sql<number>,
                    and the `?? '0'` fallbacks became `?? 0`. UI:
                    pages/finance/fees.vue + invoices.vue + billing.vue
                    now convert naira text input → kobo via
                    parseNairaToKobo before posting, and prefill forms
                    via koboToNaira(kobo); billing.vue's totalBalance/
                    totalPaid computeds sum kobo integers (no Number()
                    cast, no toFixed(2)); formatMoney already divides
                    kobo by 100. Tests: shared/__tests__/finance.test.ts
                    rewritten — parseNairaToKobo / koboToNaira / sumKobo /
                    multiplyKobo / formatMoney (kobo → currency); schema
                    tests use kobo ints (5,000,000 for ₦50,000; 3,000,000
                    for ₦30,000; 250,000 for ₦2,500) and reject 0,
                    negatives, and non-integers. moneyStringSchema kept
                    in common.ts (still tested by schemas.test.ts) for
                    any future string-money use case. Gates: nuxt
                    typecheck EXIT 0, vitest 413/413 across 31 files,
                    nuxt build (cloudflare-module) EXIT 0. Unchanged: database/
                    schema/finance.ts (already INTEGER kobo since Phase 2);
                    database/seeds (already kobo-native); API routes
                    (parseBody passthrough); audit-log historical rows
                    (immutable). Hyperdrive / postgres dep / seed.ts /
                    legacy-pg migrations remain until Phase 6. No remote
                    D1 provisioned; staging/production untouched.
2026-09-23  Phase 6  Admin gaps — dashboard widgets, user management,
                    roles/permissions viewer (PRD §5 + spec 04_APPFLOW
                    §3 admin flow). Three deliverables: (1) Dashboard
                    widget on pages/index.vue gated by `reports.view`,
                    calls GET /reports/overview (already existed) and
                    renders 6 stat cards (students total/active/archived,
                    teachers, parents, staff) + 3 mini tables (classes,
                    sections, subjects) + upcoming events list. (2) User
                    management surface — 8 routes under
                    app/server/api/v1/{users,roles}/: GET /users
                    (paginated, role filter via EXISTS subquery on
                    user_roles→roles, name/email LIKE search, soft-delete
                    excluded via deletedAt IS NULL, group_concat(DISTINCT
                    roles.slug) for the role list), GET /users/:id (joins
                    loadUserGrants so the effective permission set is
                    authoritative — super_admin wildcard respected),
                    POST /users (admin creates a login account; 409 on
                    duplicate email; needs users.create), PUT /users/:id
                    (update profile + optional password; 422 on bad
                    email; needs users.update), DELETE /users/:id
                    (soft-delete sets deletedAt + isActive=false; needs
                    users.delete), POST /users/:id/reset-password
                    (admin-initiated; sets new hash AND revokes all
                    sessions for that user via sessions DELETE WHERE
                    user_id = ?; needs users.update), PUT
                    /users/:id/roles (REPLACE role set — delete all
                    existing user_roles then insert new set inside a
                    single D1 batch; refuses empty array and unknown
                    roleIds via 422; also revokes sessions so the user
                    re-auths with the new perms; needs users.update).
                    (3) Roles/permissions viewer — GET /roles (5 roles
                    with permission counts) + GET /roles/:id (full
                    permission list grouped by category, read-only —
                    admins inspect, never edit, the 104-slug catalog).
                    Files: shared/schemas/users.ts + roles.ts (zod
                    validation, email regex, password min 8, roleIds
                    non-empty array); server/services/users.ts (both
                    user-mgmt and roles viewer live here — listUsers,
                    getUserOrThrow, createUser, updateUser,
                    adminResetPassword, setUserRoles, softDeleteUser,
                    listRoles, getRoleDetailOrThrow, listRolesForPicker);
                    8 API routes; services/users.ts client wrappers
                    (usersApi + rolesApi); pages/users.vue + roles.vue;
                    pages/index.vue dashboard section + 2 new People
                    nav links (Users, Roles). Authorization: every
                    route uses requirePermission + a server-side
                    actor-business-ids check — students are blocked
                    from /users entirely (403) even if mistakenly
                    granted users.view. Audit: every mutation writes
                    an audit_log entry (user.create / user.update /
                    user.password.reset / user.roles.update /
                    user.delete) via writeAudit at the route layer.
                    Tests: shared/__tests__/users.test.ts — 19 new
                    tests covering zod schemas (email validation,
                    password min length, roleIds non-empty, gender
                    enum, isActive boolean, phone optional). D1
                    GOTCHA found+fixed during smoke: drizzle's
                    `group_concat(DISTINCT r.slug)` with a literal
                    alias FAILS on D1 — must use the column reference
                    `${roles.slug}` in the .select() builder (raw
                    sql\`...\` subqueries like auth/context.ts use
                    literal table names `user_roles ur`/`roles r`,
                    which still works). Gates: nuxt typecheck EXIT 0,
                    vitest 432/432 across 32 files, nuxt build
                    (cloudflare-module) EXIT 0. Local D1 smoke
                    (wrangler dev) ALL flows pass: health db=true,
                    RBAC login OK, GET /users with role filter + search,
                    GET /users/:id with effective perms, GET /roles 5
                    roles + perm counts, GET /roles/:id perms grouped,
                    POST /users 201, 409 duplicate email, PUT
                    /users/:id/roles replaces grants + revokes
                    sessions, POST /users/:id/reset-password revokes
                    sessions, 422 bad email, 422 empty roles array, 422
                    unknown roleId, 403 student-blocked-from-users,
                    404 deleted-user, audit entries verified via
                    superadmin. Unchanged: 104-slug permission catalog
                    + 5-role RBAC (multi-role preserved, not flattened
                    to users.role); reports overview endpoint (already
                    existed from earlier phase). Hyperdrive / postgres
                    dep / seed.ts / legacy-pg migrations remain until
                    Phase 14. No remote D1 provisioned;
                    staging/production untouched.
2026-09-23  Phase 7 Option A  Teacher self-service (PRD §6 + spec
                    04_APPFLOW §4 teacher flow). Teachers now get a
                    scoped experience instead of the admin dashboard:
                    (1) new service server/services/teachers-self.ts
                    with getTeacherSelf / listMyClasses /
                    listMyStudents / listSubmissionsToGrade — every
                    query resolves teacherId server-side via
                    resolveActorBusinessIds + teacherTaughtClassIds
                    and NEVER accepts a teacherId from the client;
                    a classId the teacher does not teach narrows to an
                    empty page (never an error, never other classes).
                    (2) 4 routes: GET /teachers/me (dashboard.view;
                    profile + assigned classes + today's timetable +
                    pending submitted/late submissions count + 5
                    latest announcements; 404 for accounts with no
                    teacher profile), GET /teacher-assignments/me
                    (teachers.view; self-service variant reusing the
                    admin listTeacherClassAssignments shape), GET
                    /teachers/me/students (students.view; paginated
                    roster with primary guardian contact), GET
                    /teachers/me/to-grade (submissions.view; one row
                    per owned assignment with pending review count).
                    (3) 4 pages: /teachers/me (profile card + quick
                    stats + today's timetable + announcements),
                    /my-classes, /my-students (classId/search/paging),
                    /submissions/to-grade (rows deep-link to the
                    existing /assignments/[id] grading view). (4)
                    Teacher widget on pages/index.vue (best-effort
                    GET /teachers/me; 404/other failure hides the
                    widget — admins/students/parents unaffected).
                    (5) Scoping cleanup: assignments service migrated
                    off its duplicated local getActor onto the
                    canonical request-cached resolveActorProfile —
                    listAssignments now scopes non-admin teachers by
                    teacherId (14 assignment routes + my/assignments
                    + 6 resources routes migrated); listPublications
                    in exams service accepts the actor and scopes
                    teachers to taught classes. Files:
                    shared/schemas/teachers.ts (myStudentListQuerySchema,
                    submissionsToGradeQuerySchema) + barrel;
                    shared/types/index.ts (TeacherSelf,
                    TeacherStudentRow, TeacherAssignmentToGradeRow);
                    services/teachers.ts client wrappers.
                    Tests: shared/__tests__/teachers.test.ts — 10 new
                    zod contract tests. Gates: nuxt typecheck EXIT 0,
                    vitest 442/442 across 33 files, nuxt build
                    (cloudflare-module) EXIT 0 (no wrangler in
                    .output). Local D1 smoke (wrangler dev, demo
                    teacher T001): health db=true; /teachers/me
                    profile + 1 class + 1 today period + 2
                    announcements; /teacher-assignments/me 1 row;
                    /teachers/me/students 2 rows, assigned-class
                    filter 2, foreign-class filter 0, search "Amara"
                    1; /teachers/me/to-grade empty queue matches
                    pending count 0; teacher 403 on admin
                    /teacher-assignments; student login 404 on
                    /teachers/me and 403 on /teacher-assignments/me.
                    Unchanged: 104-slug catalog + 5-role multi-role
                    RBAC; existing grading/attendance/timetable
                    routes. Option B (/exam-results/enter score-entry
                    UI, /teachers/me deep-link tabs) and Option C
                    (split admin/teacher assignment pages, teacher
                    landing route guard) remain unstarted pending
                    owner sign-off. Hyperdrive / postgres dep /
                    seed.ts / legacy-pg migrations remain until
                    Phase 14. No remote D1 provisioned;
                    staging/production untouched.
2026-09-24  Phase 8 Option A  Student self-service (PRD §6 + spec
                    04_APPFLOW §4 student flow). Students now get
                    a scoped dashboard instead of the admin
                    overview: (1) new service
                    server/services/students-self.ts with
                    getStudentSelf / listMyTimetable /
                    getMyResults — every query resolves studentId
                    server-side via resolveActorBusinessIds +
                    studentEnrolledClassIds and NEVER accepts a
                    studentId from the client; 404s when the caller
                    has no linked student record (admins/teachers/
                    parents hitting /students/me see empty state,
                    not 500). (2) 3 routes: GET /students/me
                    (dashboard.view; profile + active enrollment +
                    today's timetable top 10 + 5 pending
                    assignments + 5 recent announcements), GET
                    /students/me/timetable (timetable.view; full
                    weekly view, 100-row page, optional
                    sessionId/weekday filter), GET
                    /students/me/results (exam_results.view;
                    reuses getStudentResults which enforces the
                    publication lock — students see nothing until
                    published; requires sessionId+termId UUIDs).
                    (3) 1 page: /students/me (profile card + 3
                    quick-stats linking to /timetable,
                    /my/assignments, /results; today's timetable
                    list; pending assignments list; recent
                    announcements list). (4) Student widget on
                    pages/index.vue (best-effort GET /students/me;
                    404/other failure hides the widget —
                    admins/teachers/parents unaffected; mirrors
                    the teacher widget pattern). (5) Existing
                    student surfaces reused unchanged: /my/
                    assignments, /assignments/[id]/submission*,
                    /attendance/students/[id], /students/[id]/
                    results, /students/[id]/enrollments,
                    /timetable, /announcements, /resources,
                    /results page. Files: shared/schemas/students.ts
                    (myTimetableQuerySchema, myResultsQuerySchema)
                    + barrel; shared/types/index.ts (StudentSelf,
                    StudentSelfProfile, StudentActiveEnrollment);
                    services/students.ts client wrappers. Tests:
                    shared/__tests__/students.test.ts — 9 new zod
                    contract tests (weekday allowlist, UUID
                    rejection, no-silent-default for results,
                    strips smuggled studentId). Gates: nuxt
                    typecheck EXIT 0, vitest 451/451 across 34
                    files, nuxt build (cloudflare-module) EXIT 0
                    (4.34 MB total, 1.47 MB gzip). Local D1 smoke
                    (wrangler dev, demo student STU-001):
                    /students/me 200 (profile + activeEnrollment +
                    todayTimetable 1 + pendingAssignments 0 +
                    recentAnnouncements 2); /students/me/timetable
                    200 (7 entries weekly view);
                    /students/me/results?sessionId+termId 200
                    (publicationStatus=published, English Studies
                    85/100 grade A); /students/me/results (no
                    params) 422 zod validation; RBAC: anonymous
                    /students/me 401; teacher /students/me 404
                    ("No student profile linked to this
                    account"). Unchanged: 104-slug catalog +
                    5-role multi-role RBAC; existing
                    assignments/attendance/timetable/exams routes.
                    Hyperdrive / postgres dep / seed.ts / legacy-pg
                    migrations remain until Phase 14. No remote D1
                    provisioned; staging/production untouched.
2026-09-24  Phase 9 Option A  Parent self-service (PRD §6 + spec
                    04_APPFLOW §4 parent flow). Parents now get a
                    scoped dashboard instead of the admin overview:
                    (1) new service
                    server/services/parents-self.ts with
                    getParentSelf / listMyChildren / getChildResults /
                    getChildAttendance — every query resolves parentId
                    + children server-side via resolveActorBusinessIds
                    and NEVER accepts a parentId from the client;
                    child-specific routes take a studentId path param
                    but assertChildOf() re-verifies it is in
                    actor.children before returning data (403 on
                    probe). getParentSelf 404s when the caller has no
                    linked parent record (admins/teachers/students see
                    empty state, not 500). (2) 4 routes: GET
                    /parents/me (dashboard.view; profile + children
                    list with current class/section + recent
                    announcements + outstanding fees summary
                    computed from student_invoices for the actor's
                    children: outstandingInvoiceCount,
                    outstandingBalance kobo, overdueInvoiceCount),
                    GET /parents/me/children (students.view), GET
                    /parents/me/children/:studentId/results
                    (exam_results.view; reuses getStudentResults which
                    enforces parent ownership + publication lock),
                    GET /parents/me/children/:studentId/attendance
                    (attendance.view; reuses studentAttendance which
                    enforces parent ownership via assertStudentAccess).
                    (3) 1 page: /parents/me (profile card + 3 fees
                    stat cards linking to /billing + children list
                    with Results/Attendance links to /results and
                    /attendance + recent announcements). (4) Parent
                    widget on pages/index.vue (best-effort GET
                    /parents/me; 404 hides widget — mirrors the
                    teacher/student widget pattern). (5) Existing
                    parent surfaces reused unchanged: /results and
                    /attendance pages already resolve the parent's
                    children via getMySchoolContext; /billing
                    invoices/payments already scope parents via
                    getFinanceActor.childIds; /timetable already
                    parent-scopes via classifyActorScope. Files:
                    shared/schemas/parents.ts
                    (myChildResultsQuerySchema requires sessionId+
                    termId UUIDs, strips smuggled parentId/studentId)
                    + barrel; shared/types/index.ts (ParentSelf,
                    ParentSelfProfile, ParentChildSummary,
                    ParentFeesSummary); services/parents.ts client
                    wrappers. Tests: shared/__tests__/parents.test.ts
                    — 5 new zod contract tests. Gates: nuxt typecheck
                    EXIT 0, vitest 456/456 across 35 files, nuxt build
                    (cloudflare-module) EXIT 0 (4.36 MB total, 1.48
                    MB gzip). Local D1 smoke (wrangler dev port 8787,
                    demo parent Ngozi Okafor linked to STU-001 Amara
                    Okafor Primary 1): /parents/me 200 (profile + 1
                    child + fees {1 outstanding, 2,750,000 kobo =
                    ₦27,500, 1 overdue} + 2 announcements);
                    /parents/me/children 200 (1 row, studentId
                    b3a407c9...); /parents/me/children/:id/results?
                    sessionId+termId 200 (publicationStatus=
                    published, English Studies 85/100 grade A);
                    /parents/me/children/:id/results (no params) 422;
                    /parents/me/children/:id/attendance?sessionId 200
                    (summary + 1 row); /parents/me/children/:id/
                    attendance (no sessionId) 422. RBAC: anonymous
                    /parents/me 401; teacher /parents/me 404 ("No
                    parent profile linked to this account."); parent
                    probing FOREIGN studentId on
                    /parents/me/children/:foreignId/results 403
                    ("You can only view your own children.").
                    Unchanged: 104-slug catalog + 5-role multi-role
                    RBAC; existing attendance/exams/finance/timetable
                    routes. Hyperdrive / postgres dep / seed.ts / legacy-pg
                    migrations remain until Phase 14. No remote D1
                    provisioned; staging/production untouched.
2026-09-24  Phase 11 Option A  R2 consolidation (MIGRATION_GAP_REPORT
                    §9 + D6). The R2 access layer was already
                    centralized in server/utils/storage.ts (putObject,
                    getObjectBytes, deleteObject, streamObject,
                    buildObjectKey, getR2Bucket); this phase hardens
                    and extends it. Changes to storage.ts: (1) added
                    assertR2Available(event) — a semantically explicit
                    fail-fast alias for getR2Bucket that reads as intent
                    ("verify storage before mutating the database"); (2)
                    added deleteObjects(event, keys[]) — batch delete
                    helper that fails fast on the first error (callers
                    append .catch(()=>{}) for best-effort cleanup); (3)
                    added headObject(event, key) returning size/
                    contentType/etag/lastModified without downloading
                    the body, plus objectExists(event, key) boolean
                    convenience; (4) extended R2ObjectLike with etag +
                    lastModified fields. Route refactors (no behavior
                    change): (a) 3 delete routes (resources/[id].delete,
                    assignments/[id].delete, assignments/[id]/
                    attachments/[attachmentId].delete) replaced bare
                    getR2Bucket(event) fail-fast calls with
                    assertR2Available(event); (b) assignments/[id].delete
                    replaced its for...of deleteObject loop with
                    deleteObjects; (c) gallery/albums/[id].delete and
                    gallery/albums/[id]/images/[imageId].delete replaced
                    their try/catch deleteObject loops with
                    deleteObjects(...).catch(()=>{}); (d) gallery/
                    albums/[id]/images/index.post.ts replaced the
                    Promise.all(keys.map(deleteObject)) rollback with
                    deleteObjects(...).catch(()=>{}). After this phase,
                    getR2Bucket is called ONLY from within storage.ts —
                    no route touches the binding directly. No schema
                    change (the unified documents table from D6 remains
                    optional and out of scope; 7 metadata tables
                    continue to store object keys independently). No
                    new routes. Tests: server/utils/__tests__/
                    storage.test.ts — 9 new tests covering
                    assertR2Available (present/absent binding),
                    headObject + objectExists (present/missing),
                    deleteObjects (order + empty no-op + fail-fast),
                    and buildObjectKey regression. Gates: nuxt
                    typecheck EXIT 0, vitest 465/465 across 36 files,
                    nuxt build (cloudflare-module) EXIT 0 (4.37 MB
                    total, 1.48 MB gzip). Local D1 smoke (wrangler dev
                    port 8787, admin): DELETE /assignments/:id 200
                    {ok:true} (assertR2Available + deleteObjects path;
                    count 2→1); DELETE /gallery/albums/:id 204
                    (deleteObjects with .catch; count 2→1); DELETE
                    /resources/:non-existent 404 "Resource not found."
                    (assertR2Available passes, R2 binding present).
                    Unchanged: 104-slug catalog + 5-role multi-role
                    RBAC; all upload/download routes; R2 private-by-
                    design with authorized streaming. Hyperdrive /
                    postgres dep / seed.ts / legacy-pg migrations
                    remain until Phase 14. No remote D1 provisioned;
                    staging/production untouched.
2026-09-24  Phase 12 Option A  KV caching (TRD §12 + §16;
                    MIGRATION_GAP_REPORT §17 phase plan item 6).
                    Pre-flight confirmed the EDGE_KV binding is already
                    declared in wrangler.toml (local/staging/
                    production) and that the two prior KV consumers
                    are already production-shaped: the rate limiter
                    (server/utils/auth/throttle.ts) uses `rl:` prefix
                    counters with in-memory fallback and fails OPEN on
                    KV errors, and the session revocation list
                    (server/utils/auth/revocation.ts) uses `sess:rev:`
                    and `sess:nb:` markers and fails CLOSED on bound-KV
                    lookup errors (security-correct). Both have full
                    FakeKv/ThrowingKv test coverage. The remaining
                    caching opportunity was school-settings (read on
                    every authenticated page via GET /api/v1/my/
                    school-settings; admin-only writes via PUT
                    /api/v1/school-settings; rarely changes). Public-
                    website content cache was N/A (Phase 5 skipped).
                    Changes: (1) added server/utils/cache.ts — a small
                    read-through KV cache utility: cacheKey(parts)
                    joins parts under the `cache:` namespace (kept
                    distinct from `rl:` and `sess:`); getOrSet(event,
                    key, ttl, loader) returns the cached JSON value on
                    a hit, otherwise calls loader, persists the JSON-
                    serialised result with expirationTtl clamped to
                    the KV minimum of 60s, and returns it; invalidate
                    (event, key) and invalidateMany(event, keys[])
                    provide best-effort deletes (empty list is a
                    no-op; individual delete errors are swallowed).
                    Fail-open: when EDGE_KV is unbound (plain nuxt
                    dev) the loader result is returned directly and
                    nothing is written; KV get/put/delete errors are
                    caught, logged, and the loader result is still
                    returned. (2) Wired school-settings service to
                    the cache: getSchoolSettings(event) and
                    getPublicSchoolSettings(event) now read through a
                    single KV entry `cache:school:settings` with a 60s
                    TTL; the public subset derives from the cached full
                    object (no second cache key, no double-
                    invalidation). updateSchoolSettings(event, patch)
                    upserts the patched keys, then invalidate()s the
                    cache and re-reads so the returned value is fresh
                    and the next caller's read is repopulated. (3)
                    Threaded H3Event through the three API call sites
                    (index.get, index.put, my/school-settings.get).
                    No routes added, no schema change, no migrations.
                    Tests: 16 new in server/utils/__tests__/cache.test
                    ts (cacheKey shape; getOrSet hit/miss/TTL clamp/
                    null-as-miss/no-binding bypass/get-throws/
                    put-throws; invalidate noop-on-empty + swallow-
                    errors; invalidateMany batch + continue-on-error)
                    and 5 new cache cases in server/services/__tests__/
                    school-settings.test.ts (cache-after-first-read;
                    fall-through on miss; bypass when unbound;
                    invalidate-on-update + fresh re-read; public
                    subset reads from same cache entry). Drive-by:
                    fixed two pre-existing TS2339 errors in
                    server/utils/__tests__/storage.test.ts (Phase 11
                    regression that slipped past the typecheck gate —
                    `bucket.delete.mock.calls` lost the Mock typing
                    through `as unknown as R2BucketLike`; extracted
                    deleteMock as a typed vi.fn() variable before the
                    cast). Gates: nuxt typecheck EXIT 0; vitest 486/
                    486 across 37 files (Phase 11 baseline 465/36 ->
                    +21 tests +1 file); cloudflare-module build EXIT
                    0 (4.37 MB total / 1.48 MB gzip, unchanged). D1
                    smoke on wrangler dev port 8787 (admin@victorious
                    children.school): GET /api/v1/my/school-settings
                    200 (twice, identical payloads — second served
                    from cache); GET /api/v1/school-settings 200
                    (admin full); PUT /api/v1/school-settings 200 with
                    {motto:"...smoke"} — trailing read repopulated
                    cache with the new value; follow-up GET returned
                    the fresh motto (invalidation proven); restored
                    motto to seed value; anonymous GET on both routes
                    401 (RBAC unchanged). Unchanged: 104-slug RBAC;
                    EDGE_KV binding and its rl:/sess: consumers; all
                    other services. Hyperdrive / postgres dep /
                    seed.ts / legacy-pg migrations remain until Phase
                    14. No remote D1 provisioned; staging/production
                    untouched.
2026-09-24  Phase 13 Option A  Reporting/Polish (MIGRATION_GAP_REPORT
                    §17 phase plan item 7). Pre-flight inspection
                    surfaced two backend-implemented reports that were
                    never wired into any UI surface: GET /reports/
                    admissions (admissions pipeline funnel, 11 stages
                    + total, built in Phase 11) and GET /reports/
                    audit-certificate (PDF attestation of audit-log
                    activity, built in Phase 11 Part C Option B). Both
                    had services + routes + types + schemas complete
                    but no client wrappers, no admin page section, and
                    no download button anywhere. Option A scope
                    (confirmed by user) = surface these two existing
                    reports in the admin UI; no new backend, no new
                    routes, no schema changes. Changes: (1) Client
                    wrappers in services/reports.ts: reportsApi.
                    admissions(params?) returns AdmissionsPipeline
                    Report; downloadAuditCertificate(fileName,
                    params?) triggers a PDF blob download via window
                    fetch (mirrors downloadCsv but skips the format
                    param — the audit-certificate endpoint always
                    returns application/pdf). (2) Admin Reports page
                    (pages/reports/index.vue): loadOverview now
                    Promise.all-fetches admissions pipeline alongside
                    overview/attendance/enrollments (gated by
                    admissions.view); new Admissions pipeline section
                    renders an 11-stage funnel table with Stage |
                    Count | Share (%) columns + a trailing Total row;
                    Exports section renamed from "CSV exports" to
                    "Exports" and gained an "Admissions pipeline CSV"
                    button (gated by reports.export && admissions
                    loaded) and an "Audit certificate (PDF)" button
                    (gated by reports.export && audit_logs.view —
                    only super_admin sees it since the admin role
                    intentionally excludes audit_logs.view per the
                    seed ADMIN_EXCLUDE list). (3) Audit-logs page
                    (pages/audit-logs/index.vue): added
                    downloadAuditCert() that passes the current
                    filter window (action/resource/userId/dateFrom/
                    dateTo — search intentionally excluded since
                    AuditCertificateQuery has no search field) to
                    downloadAuditCertificate; new "Audit certificate
                    (PDF)" button in the page header next to Export
                    CSV (gated by reports.export). (4) Tests: 9 new
                    zod contract tests in shared/__tests__/reports.
                    test.ts — admissionsPipelineQuerySchema (accepts
                    empty; accepts session/intendedClass UUIDs;
                    rejects non-UUID session; rejects non-UUID
                    intendedClass) + auditCertificateQuerySchema
                    (accepts empty; accepts all filter params;
                    rejects non-UUID userId; rejects malformed date;
                    strips unknown keys — verifying the schema
                    intentionally excludes free-text search so the
                    certificate always reflects a well-defined
                    filter window). Gates: nuxt typecheck EXIT 0;
                    vitest 495/495 across 37 files (Phase 12
                    baseline 486/37 -> +9 tests); cloudflare-module
                    build EXIT 0 (4.37 MB total / 1.48 MB gzip,
                    unchanged). D1 smoke on wrangler dev port 8787:
                    admin login OK (102 perms — admin role
                    intentionally excludes audit_logs.view + roles
                    manage per seed ADMIN_EXCLUDE); GET /reports/
                    admissions 200 (5 applications across 11 stages:
                    applied 1, under_review 1, accepted 1, rejected
                    1, enrolled 1, total 5); GET /reports/audit-
                    certificate as admin 403 (correct — admin lacks
                    audit_logs.view, button correctly hidden);
                    superadmin login OK (104 perms); GET /reports/
                    audit-certificate as superadmin 200 (PDF 3481
                    bytes, %PDF-1.7 magic header, content-type
                    application/pdf, content-disposition inline
                    filename="audit-certificate-2026-09-24.pdf").
                    Unchanged: 104-slug RBAC; all backend routes/
                    services/schemas (Phase 11 endpoints untouched);
                    Hyperdrive / postgres dep / seed.ts / legacy-pg
                    migrations remain until Phase 14. No remote D1
                    provisioned; staging/production untouched.
2026-09-24  Phase 7 Option B   Teacher self-service follow-up
                    (README §17 phase plan item 7 Option B). Pre-flight
                    confirmed all backend already existed: /exam-results
                    GET/POST + /:id GET + /:id/{submit,approve,publish}
                    POST (all actor-scoped for teachers via
                    teacherTaughtClassIds); /exams/:id/scores PUT
                    (bulkUpsertExamScores, exam_results.enter);
                    /assessment-scores POST/GET + /assessment-scores/bulk
                    PUT (bulkUpsertAssessmentScores); /teachers/me/
                    students GET (class roster, refuses foreign classIds
                    silently); assertCanEnterForStudent + assertScores
                    Unlocked enforce teacher-class ownership + publication
                    lock server-side. No new backend, no new routes, no
                    schema changes. Frontend changes: (1) NEW pages/
                    exam-results/enter.vue — single page with mode toggle
                    ('ca' continuous assessment | 'exam' exam scores),
                    shared Session/Term/Class filters (class list driven
                    by /teacher-assignments/me so teachers only see their
                    own), CA mode adds Subject (scoped to picked class
                    from same assignment list) + Assessment Type + Max
                    Score; Exam mode adds Exam (filtered by session+class)
                    + Exam Subject (loaded from getExam); roster fetched
                    via /teachers/me/students (perPage 100) and rendered
                    as an editable grid; CA mode pre-loads existing scores
                    via listAssessmentScores(sessionId+termId+subjectId+
                    assessmentTypeId) joined client-side by studentId;
                    Save calls bulkUpsertAssessmentScores or
                    bulkUpsertExamScores (idempotent via onConflictDo
                    Update). (2) pages/teachers/me.vue — added 5-tab nav
                    strip (Overview active | My Subjects→/my-classes |
                    Attendance→/attendance | Results→/exam-results/
                    enter | Timetable→/timetable); Overview keeps the
                    existing dashboard widgets unchanged. (3) pages/
                    exams.vue — removed stub 'Bulk score entry' section
                    (free-form UUID grid with no-op reloadScoreRows)
                    and unused script state (scoreRows, scoreBusy,
                    reloadScoreRows, saveBulkScores); replaced with a
                    single 'Open score entry →' NuxtLink to /exam-
                    results/enter. /my-timetable confirmed unnecessary
                    (/timetable.vue already actor-scopes). Tests: no new
                    tests (page orchestrates existing endpoints already
                    covered by backend tests; no new shared schema).
                    Gates: nuxt typecheck EXIT 0; vitest 495/495 across
                    37 files (Phase 13 baseline preserved); cloudflare-
                    module build EXIT 0 (4.39 MB total / 1.49 MB gzip).
                    D1 smoke (wrangler dev port 8787, teacher@
                    victoriouschildren.school T001 Ada Obi — 1 class
                    Primary 1 English Studies 2026/2027 First Term):
                    /teachers/me 200 + tab-nav text compiled into JS
                    bundle Dj76wVk9.js; /exam-results/enter 200 (mode
                    toggle + filters render); /teacher-assignments/me
                    200 (1 row, classId d3a9e1f3-dba2-4277-8071-22455
                    d310990, subjectId a9213a0b-2264-4ab6-a199-e560c
                    9052ec1); /teachers/me/students?classId 200 (2
                    students Amara STU-001 + David STU-002); PUT /
                    assessment-scores/bulk with score 85 → 409 'Results
                    are locked (publication status: published)' —
                    security-correct: existing publication for Ada's
                    class is in published state, assertScoresUnlocked
                    refuses the write; CSRF enforced (403 without x-csrf-
                    token, passes with sms_csrf cookie value); /exams
                    200 (2776b) with stub removed ('Student UUID'
                    placeholder count 0); /exam-results list 200
                    (publication 437340f6 status=published). RBAC: page
                    permissions enforced client-side via middleware/
                    auth.global.ts (UX guard, README §25 — Nitro server
                    middleware authoritative); API layer returns 401
                    unauthed / 403 lacking perm. Unchanged: 104-slug
                    RBAC; all backend routes/services/schemas;
                    Hyperdrive / postgres dep / seed.ts / legacy-pg
                    migrations remain until Phase 14. No remote D1
                    provisioned; staging/production untouched.
2026-09-24  PG/Neon/Hyperdrive DECOMMISSION. Total removal of every
                    PostgreSQL / Neon / Hyperdrive artefact so the
                    database stack focuses purely on Cloudflare D1.
                    Deleted: app/database/seed.ts (PG seed runner,
                    superseded by seed-d1.ts); app/drizzle.pg.config.ts
                    (PG drizzle config); app/database/migrations/
                    legacy-pg/ (4 SQL + 5 meta files); root PG-era
                    decision records MIGRATION_PLAN.md,
                    ARCHITECTURE_DECISION_RECORD.md,
                    ARCHITECTURE_FEASIBILITY_ASSESSMENT.md,
                    MIGRATION_GAP_REPORT.md (recoverable from git).
                    Edited app/wrangler.toml: removed all 3
                    [[hyperdrive]] blocks (local/staging/production)
                    + the staging Hyperdrive id; rewrote provision-once
                    headers to D1/R2/KV/Queues/Cron only. Edited
                    app/package.json: dropped the `postgres` dependency;
                    removed db:pg:* / db:push / db:studio scripts;
                    repointed db:migrate -> db:d1:migrate and
                    db:seed -> db:d1:seed. Edited app/.env.example +
                    gitignored app/.env: removed DATABASE_URL and
                    STAGING_DATABASE_URL blocks (preserved
                    SESSION_SECRET); no DATABASE_URL is needed — D1
                    is reached via the DB binding. Edited
                    app/nuxt.config.ts: removed the databaseUrl
                    runtimeConfig key + Hyperdrive comments. Cleaned
                    stale PG-fallback prose in server/utils/db.ts,
                    server/plugins/cloudflare.ts (removed the dead
                    DATABASE_URL runtime bridge),
                    database/seed-d1.ts, drizzle.config.ts, schema
                    file headers (enums/core/people/academics/
                    enrollment), seeds/index.ts, and service/utils
                    comments (assignments/events/schedule/resources/
                    storage/gallery-thumbnails/http-errors — kept the
                    defensive SQLSTATE branches). Documentation
                    rewrites: README §§1/6/29/30/31/39/40/45/46/47/
                    48/49/50/52 + this change-log entry;
                    PROJECT_RULES.md; .trae/rules/project_rules.md;
                    docs/DATABASE.md (D1-only); docs/CLOUDFLARE.md
                    (Hyperdrive section removed). NOT touched
                    (per owner decision, separate pass): frontend/
                    Vue+Vite scaffold and app/wrangler.pages.toml
                    (still contains [[hyperdrive]] text but is not
                    loaded by Wrangler — flagged as known-deferred).
                    Gates re-run: npm install, type-check, test,
                    build, wrangler deploy --dry-run, db:d1:migrate +
                    db:d1:seed, cf:dev smoke. ACTION FOR OWNER:
                    rotate the Neon staging password (npg_8bGUASvCfL1H
                    was in the now-deleted .env STAGING_DATABASE_URL
                    line — the Neon db will be decommissioned during
                    the staging cutover, but rotate as a precaution).
                    Staging/production D1 database ids remain
                    placeholders until the Phase 13 staging cutover.
```

## 52. v2.0 D1 spec package (2026-09-21)

The v2.0 spec package is the **authoritative** directive for the
D1 migration. It supersedes earlier PostgreSQL-retention statements in
this README and in `PROJECT_RULES.md` per the project owner's
2026-09-21 decision (see §51 change log). The package lives under
version control at:

-   [docs/spec/v2/README.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/README.md) — master rules
-   [docs/spec/v2/01_PRD.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/01_PRD.md) — product requirements
-   [docs/spec/v2/02_TRD.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/02_TRD.md) — technical architecture
-   [docs/spec/v2/03_UI_UX_DESIGN_BRIEF.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/03_UI_UX_DESIGN_BRIEF.md) — visual/interaction requirements
-   [docs/spec/v2/04_APPFLOW.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/04_APPFLOW.md) — workflows
-   [docs/spec/v2/05_BACKEND_SCHEMA.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/05_BACKEND_SCHEMA.md) — D1 schema
-   [docs/spec/v2/06_IMPLEMENTATION_PLAN.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/06_IMPLEMENTATION_PLAN.md) — implementation/migration
-   [docs/spec/v2/07_MIGRATION_GAP_REPORT_TEMPLATE.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/07_MIGRATION_GAP_REPORT_TEMPLATE.md) — first-repository-inspection template
-   [docs/spec/v2/TRAE_STRICT_COMPLIANCE_PROMPT.md](file:///Users/mac/Documents/School_Management_System/docs/spec/v2/TRAE_STRICT_COMPLIANCE_PROMPT.md) — TRAE operating contract

Authority order (per package README §4): explicit project-owner
decision → this README → PRD → TRD → UI/UX → AppFlow → Backend Schema
→ Implementation Plan.

Phase 0 deliverable: the MIGRATION_GAP_REPORT.md at repo root was the
first-repository-inspection template (approved 2026-09-21); it was
deleted 2026-09-24 as part of the PostgreSQL/Neon/Hyperdrive
decommission (recoverable from git history).

### Migration status

-   **PostgreSQL/Neon/Hyperdrive decommissioned 2026-09-24; D1 is the
    sole database engine.** The `postgres` npm dependency, all
    `[[hyperdrive]]` blocks, the PG seed runner, the PG drizzle config,
    and the `legacy-pg/` migration tree are gone. No `DATABASE_URL` or
    `STAGING_DATABASE_URL` is read anywhere.
-   Money = INTEGER kobo (₦150,000 = 15,000,000); scores/weights/
    boundaries = INTEGER fixed-point ×100; timestamps TEXT ISO-8601
    UTC; dates `YYYY-MM-DD`; times `HH:MM:SS`; IDs TEXT app-generated
    UUIDs; enums TEXT + CHECK.
-   Existing 5-table RBAC (multi-role, 104 permission slugs) is kept
    (no flattening to `users.role`).
-   Sessions stay stateless signed cookies + KV revocation (no D1
    sessions table).
-   Drizzle generates SQLite DDL; `wrangler d1 migrations` is the
    single applier/tracker.

### Migration phases (historical — from the deleted MIGRATION_GAP_REPORT §16)

1.  Architecture reset (D1 binding declared) — ✅ COMPLETE.
2.  Schema rewrite (52 PG tables → SQLite DDL; 16 pgEnums → TEXT +
    CHECK; 201 PG-specific call sites adapted) — ✅ COMPLETE.
3.  Query dialect migration (40 `ilike` → `LIKE`; 17 interactive
    transactions → D1 batch; ~20 PG raw-SQL fragments rewritten) —
    ✅ COMPLETE.
4.  Paystack net-new (init + webhook + verify + ledger) — deferred to
    SMS Phase 15.
5.  Public website net-new — deferred to SMS Phase 18.
6.  D1 staging acceptance → PG decommission — PG decommission DONE
    2026-09-24; D1 staging acceptance (provisioning + remote migrate +
    seed + smoke) remains part of the SMS Phase 13 staging cutover.
7.  Production cutover — not started (SMS Phase 19 launch).

Each phase followed: `Inspect → Plan → Implement → Test → Review →
Document → Commit`. The destructive Hyperdrive removal and PG schema
deletion were authorized by the project owner on 2026-09-24.
