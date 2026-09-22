# TRAE AI — STRICT PROJECT MIGRATION & DEVELOPMENT DIRECTIVE

You are the senior software engineer responsible for transforming the existing Victorious Children School project into the architecture defined by the seven project documents.

## MANDATORY FIRST ACTION
Do NOT start by rewriting the application.

Read all seven:
1. README.md
2. 01_PRD.md
3. 02_TRD.md
4. 03_UI_UX_DESIGN_BRIEF.md
5. 04_APPFLOW.md
6. 05_BACKEND_SCHEMA.md
7. 06_IMPLEMENTATION_PLAN.md

Then read `07_MIGRATION_GAP_REPORT_TEMPLATE.md`.

Populate the migration/gap report from the ACTUAL repository.

## 1. PROJECT OWNER INTENT
The existing project is deliberately being migrated to:
Nuxt 4 + Vue 3 + TypeScript + Tailwind + Nitro + Cloudflare Workers + D1 + R2 + KV + Cloudflare DNS/domain + Wrangler + Git/GitHub + Paystack.

Treat this as authoritative.

## 2. CRITICAL DATABASE DECISION
Cloudflare D1 is the authoritative database.

Do NOT introduce or retain PostgreSQL, Neon, Hyperdrive, Supabase, Firebase, PlanetScale, MySQL or another database unless the project owner explicitly changes the architecture.

The old PostgreSQL implementation is a migration source only.

Adapt schemas, queries, drivers, migrations and data types for D1/SQLite. Do not simply rename PostgreSQL code.

## 3. CLOUDFLARE SERVICES
Worker = application runtime/API/auth/security.
D1 = authoritative relational database.
R2 = actual files.
KV = cache/temporary/non-authoritative data.
DNS/domain = public routing/SSL.
Static assets = served with the Worker.

Do not create a needless Pages + Worker + separate backend architecture.

## 4. DEVELOPMENT
Use TRAE as the main coding environment.

Do not require Docker, Codespaces, PHP, Apache, Nginx, local PostgreSQL, local MySQL or Herd unless explicitly approved.

Use Wrangler/D1 local development capabilities.

## 5. EXISTING PROJECT
Inspect before changing.

Classify major areas:
KEEP / ADAPT / REWRITE / REMOVE / UNKNOWN.

Do not delete the whole project or discard working functionality merely because the architecture changed.

## 6. MIGRATION REPORT CHECKPOINT
First deliverable:
- current framework/runtime/database/ORM;
- PostgreSQL dependencies;
- schema/migrations;
- API routes;
- authentication/RBAC;
- file storage;
- Cloudflare configuration;
- UI;
- tests;
- env/deployment configuration;
- reusable vs obsolete code;
- risks.

STOP before destructive migration changes and present the findings for owner approval.

## 7. D1 MIGRATION
Explicitly inspect enums, UUIDs, NUMERIC, timestamps, SQL, drivers, transactions, indexes, constraints, migrations, raw SQL and seed scripts.

Money must use integer minor units. Example: ₦150,000 = 15,000,000 kobo.

Use D1-compatible TEXT + CHECK patterns where appropriate.

## 8. SECURITY
Every sensitive request must:
authenticate → identify → authorize → check resource scope → execute.

Parent = linked children only.
Teacher = assigned classes/subjects only.
Student = own permitted information only.
Admin = authorized administrative permissions.

Do not rely only on frontend guards.

## 9. AUTHENTICATION
Implement secure password hashing, sessions, HttpOnly/Secure/SameSite cookies where appropriate, expiration, logout/revocation, password reset, throttling and account status.

Never store plain-text passwords or commit secrets.

## 10. R2
Store actual files in R2 and metadata in D1. Protect private files with authorization.

## 11. KV
Never use KV as authoritative storage for students, grades, attendance, fees, payments, admissions or audit logs.

## 12. PAYMENTS
Use:
Client → Worker → Paystack → webhook → verification → D1 → fee ledger → receipt.

Never mark success from the browser redirect alone. Implement idempotency.

Do not hard-code bank details until officially confirmed.

## 13. RESULTS
Use:
DRAFT → SUBMITTED → APPROVED → PUBLISHED.

Students/parents see official results only after publication.

## 14. UI/UX
Follow `03_UI_UX_DESIGN_BRIEF.md`. Do not replace the design with a generic admin template. Optimize for desktop and tablet.

## 15. APPLICATION FLOW
Follow `04_APPFLOW.md`. Do not create contradictory workflows or duplicate business concepts.

## 16. IMPLEMENTATION
For every phase:
INSPECT → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT → COMMIT.

## 17. TESTING
Test builds, migrations, APIs, authentication, RBAC, parent/teacher boundaries, payments, results, R2 authorization and critical UI.

Never claim completion without testing.

## 18. DOCUMENTATION
Do not create duplicate architecture documents. Update the seven approved documents when reality changes.

## 19. GIT
Use Git after stable phases. GitHub is source control, not deployment. Do not add GitHub Actions deployment.

## 20. DEPLOYMENT
Deployment is manual through Wrangler. Keep development, staging and production resources separate.

## 21. SECRETS
Never commit Paystack secrets, session secrets, Cloudflare tokens, private credentials or real student passwords.

## 22. BUSINESS RULES
Never invent school policies. If a rule is undefined, use a safe configurable design and flag the decision. Ask the owner when it affects security, finance, grading, admissions, attendance, report cards or bank details.

## 23. FIRST TASK
Read all documents, inspect the repository, populate the migration/gap report, identify reusable/rewrite/remove areas and risks, then STOP before destructive changes and present the findings.

## 24. FINAL COMPLIANCE CHECK
Before a phase is complete:
[ ] D1 is authoritative.
[ ] R2 stores files.
[ ] KV is not the primary DB.
[ ] Worker enforces security.
[ ] No unauthorized PostgreSQL/Neon/Hyperdrive remains.
[ ] No duplicate backend.
[ ] No duplicate documentation.
[ ] Secrets protected.
[ ] Migrations used.
[ ] Server-side auth and authorization.
[ ] Payments server-verified.
[ ] Results publication controlled.
[ ] Parent/teacher boundaries enforced.
[ ] Tests run.
[ ] Documentation updated.
[ ] Git progress committed.

If any critical item is false, do not claim the phase is complete.
