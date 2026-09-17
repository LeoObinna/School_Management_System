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
-   Compute: Cloudflare Workers + Workers Static Assets (Nitro
    `cloudflare-module` preset, deployed manually with Wrangler).
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
LOCAL DEV (Mac + DATABASE_URL) -> STAGING -> PRODUCTION
```

### Local development

Development runs on the local machine with Node 24 and npm from `app/`.
PostgreSQL runs locally through **Postgres.app** (database `sms_dev`,
trust auth on localhost) and is reached via `DATABASE_URL` in the
gitignored `app/.env` for `nuxt dev`, drizzle-kit and the seeder. Under
`wrangler dev` the same database is reached through a locally emulated
HYPERDRIVE binding (`localConnectionString` in `wrangler.toml`), with R2
emulated on local disk — no remote Cloudflare resources are needed for
development. No Docker, Kubernetes, Redis, Codespace, PHP, Composer or
Laravel tooling is required; background jobs will use Cloudflare Queues
(Phase 10).

``` text
npm install
npm run dev       # Nuxt dev server (Node runtime)
npm run cf:dev    # build + wrangler dev (Workers + binding emulation)
```

### Remote / managed services

-   Staging and production PostgreSQL run on a managed provider
    (planned: PlanetScale PostgreSQL), reached from Workers via separate
    Cloudflare Hyperdrive configs. Nothing is provisioned remotely
    during local development.
-   R2 objects, Queues and the Worker runtime are Cloudflare-managed.
-   No PHP, Composer, Redis server, or long-lived application server is
    required anywhere.

### Staging

Worker `sms-staging` (Wrangler named environment `staging`), separate
`sms-staging` R2 bucket, separate staging Hyperdrive config and managed
PostgreSQL database, and separate secrets.

### Production

Worker `sms-production` (Wrangler named environment `production`),
`sms-production` R2 bucket, separate production Hyperdrive config and
PostgreSQL, Full (strict) TLS and WAF. Never share production
credentials with staging. Never use real student data in staging.

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
Postgres.app (verified: PostgreSQL server 16.15; creates a local
superuser matching the macOS user, trust auth on localhost)
```

## 31. Local setup

``` bash
# 1. Install dependencies (from app/)
cd app
npm install

# 2. Create the local development database once (Postgres.app running,
#    default server on localhost:5432; -U is the macOS username):
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb \
  -h localhost -p 5432 -U "$USER" sms_dev
#    Connection string used below:
#    postgresql://$USER@127.0.0.1:5432/sms_dev (no password; trust auth)

# 3. Create your local environment file (never committed)
cp .env.example .env
#    edit .env: set DATABASE_URL to the sms_dev URL above and a random
#    SESSION_SECRET (openssl rand -base64 48)

# 4. Prepare the database (direct connection, not Hyperdrive)
npm run db:migrate
npm run db:seed        # fake demo data only

# 5. Authenticate Wrangler once (opens the browser) — only required for
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
npm run dev       # http://localhost:3000 (Node runtime, DATABASE_URL)
npm run cf:dev    # Workers runtime emulation with local R2 on disk and
                  # local Hyperdrive -> sms_dev (wrangler.toml
                  # localConnectionString). Never use --remote locally.
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
§39). Never deploy without passing the local checks, and never run
migrations through Hyperdrive — apply them against the direct managed
PostgreSQL URL first (`npm run db:migrate`).

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

### Deployment model — manual Wrangler to Workers

The Nuxt app builds with Nitro's `cloudflare-module` preset to
`.output/server/index.mjs` (the Worker) plus `.output/public` (Workers
Static Assets). `app/wrangler.toml` declares `main`, the `[assets]`
binding (`ASSETS`), and named environments `staging` and `production`,
each with its own Hyperdrive id and R2 bucket. Bindings reach the app
through `event.context.cloudflare.env`; the database client is
initialised from `env.HYPERDRIVE.connectionString` per isolate
(`server/plugins/cloudflare.ts` + `server/utils/db.ts`), and R2 is used
exclusively via the `R2_BUCKET` binding (no S3 key/secret in the
Worker).

``` text
Local Mac ── git push ──► GitHub (version history only; never deploys)
Local Mac ── wrangler ──► Cloudflare Workers (staging / production)
```

One-time provisioning (resources are not created by deploys):

``` text
wrangler hyperdrive create sms-pg-staging    --connection-string="$STAGING_DIRECT_PG_URL"
wrangler hyperdrive create sms-pg-production --connection-string="$PROD_DIRECT_PG_URL"
wrangler r2 bucket create sms-staging
wrangler r2 bucket create sms-production
wrangler secret put SESSION_SECRET -e staging
wrangler secret put SESSION_SECRET -e production
```

Put the returned Hyperdrive ids into `app/wrangler.toml` (replacing the
`REPLACE_WITH_*` placeholders).

Daily commands, run from `app/`:

``` text
npm run dev                # Nuxt dev server (Node; DATABASE_URL, no bindings)
npm run cf:dev             # build + wrangler dev (full Worker emulation;
                           # local Hyperdrive -> sms_dev via
                           # localConnectionString in wrangler.toml,
                           # R2 emulated on disk; never pass --remote)
npm run deploy:staging     # build + wrangler deploy -e staging
npm run deploy:production  # build + wrangler deploy -e production
```

Release order: local quality gate (§34) → `npm run db:migrate` against
the environment's direct PostgreSQL URL → manual Wrangler deploy.
`SESSION_SECRET` must remain stable across deploys;
`EXPOSE_RESET_TOKENS` must never be enabled outside local development.

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
logs; audit events go to the PostgreSQL `audit_logs` table, not to
Worker logs.

### Manual rollback (code only — never destructive to the database)

Each `wrangler deploy` creates an immutable Worker version. Rolling back
re-points traffic at a previous version and does not touch PostgreSQL,
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
unauthenticated application form is deferred to Phase 14, and R2
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
events/gallery website deferred to Phase 14. Gallery upload/download
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
(Part C / Option A). Still deferred in Phase 12: PDF audit
certificates, Excel/.xlsx exports, admissions-pipeline report, gallery
image thumbnails. See `docs/API.md` Phase 11.

### Phase 12 --- Hardening

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
  short-lived Hyperdrive client (`createWorkerDatabase` in
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
  local PostgreSQL (first delivery inserts rows; redelivery inserts
  0). Plain Node dev has no queue binding, so fan-out runs inline.
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
re-publishing leaves a stale PDF). Options B (xlsx exports + PDF audit
certificates + admissions report) and C (gallery thumbnails) remain
deferred.

Part B does NOT add email delivery yet — queue messages create in-app
notification rows only; an email provider integration remains future
work. Remaining Phase 12 workstreams deferred:

- Part C Option B: Excel/.xlsx exports (grades, attendance, admissions
  report) + PDF audit certificates + admissions-pipeline report.
- Part C Option C: gallery image thumbnails (Workers has no native
  image processing; needs a Cloudflare Images binding or wasm
  pipeline — explicit permission required per user preference).
- Shared KV/Durable-Object rate limiter and server-side session
  revocation list (infra-dependent; candidate for Phase 13).
- Performance, accessibility and staging review.

See `docs/API.md` Phase 12 (Parts A–C / Option A).

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
Runtime        Cloudflare Workers + Static Assets (cloudflare-module preset)
Database       PostgreSQL 16 (managed dev/staging/prod; Hyperdrive in Workers)
ORM            Drizzle
Validation     zod (shared schemas)
Background     Cloudflare Queues + Cron Triggers (from Phase 10)
Storage        Cloudflare R2 (R2_BUCKET binding only)
Edge           Cloudflare DNS / TLS / WAF / rate limiting
Source control GitHub (version history only; no Git-driven deployments)
Deployment     Manual Wrangler from the local Mac (wrangler deploy -e …)
IDE            TRAE CN
Dev env        Local Node 24 + reachable dev PostgreSQL (no devcontainer)
Mac            development + deployment machine (Node 24, npm, Wrangler)
Staging        Worker sms-staging + sms-staging R2 + staging Hyperdrive/PG
               (resources provisioned manually; first deploy pending the
               staging acceptance checkpoint)
Production     Worker sms-production + sms-production R2 + prod Hyperdrive/PG
               (provisioned but not deployed until staging is accepted)
Website        deferred
Current phase  Phase 12 Parts A–C / Option A ✅ COMPLETE (Phases 0–11
               done; Part A security/auth hardening: file magic-byte
               sniffing + timetable/attendance/exams row-level scoping;
               Part B queue consumer + async idempotent announcement
               fan-out; Part C Option A PDF report cards with R2
               storage + authorized download; Options B/C
               [xlsx/PDF-audit/admissions exports, gallery thumbnails],
               email delivery, payment gateway/webhook still
               deferred).
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
-   Current phase: **Phase 11 — Reports/audit ✅ COMPLETE**
    (Phases 0–11 done; public website deferred to Phase 14; payment
    gateway/webhook, PDF receipts, PDF report cards/PDF audit
    certificates, Excel/.xlsx exports, admissions-pipeline report,
    queue consumer handler, row-level scoping for teachers, and
    gallery thumbnails also deferred).

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
```
