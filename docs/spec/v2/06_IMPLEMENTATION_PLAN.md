# VICTORIOUS CHILDREN SCHOOL — IMPLEMENTATION & MIGRATION PLAN

**Version:** 2.0

## 1. Strategy
Transform the existing repository into:
```text
Nuxt + Worker + D1 + R2 + KV + DNS + Wrangler
```
The old project is a migration source, not an architecture constraint.

## PHASE 0 — Repository Audit
Inspect structure, package.json, Nuxt/Wrangler config, database, migrations, auth, APIs, UI, env vars, tests and docs.

Create a report:
`KEEP / ADAPT / REWRITE / REMOVE / UNKNOWN`

Do not perform destructive changes before this report is reviewed.

## PHASE 1 — Architecture Reset
Move away from PostgreSQL/Neon/Hyperdrive and other obsolete infrastructure while preserving compatible application code.

## PHASE 2 — D1 Foundation
Create and test users, permissions, sessions, students, guardians, teachers, sessions, terms, classes, subjects, class-subjects and enrollments.

## PHASE 3 — Academic Core
Implement assessments, grades, result publications and attendance.

## PHASE 4 — Authentication/RBAC
Implement login, logout, sessions, hashing, reset, permissions, account status and security logging.

## PHASE 5 — Public Website
Build/refactor Home, About, Academics, Admissions, Fees, News, Events, Gallery, Contact and FAQ.

## PHASE 6 — Admin
Student, guardian, teacher, class, subject, session/term, admissions, announcements and audit management.

## PHASE 7 — Teacher
Assigned classes, attendance, assessments, results, assignments, resources and permitted communication.

## PHASE 8 — Student
Dashboard, timetable, attendance, results, assignments, resources and announcements.

## PHASE 9 — Parent
Linked children, results, attendance, assignments, announcements, fees, payments and receipts.

## PHASE 10 — Finance
Fee structures, ledger, Paystack initialization, webhook, verification, idempotency, receipts and history.

## PHASE 11 — R2
Secure student photos, admission documents, report cards, school documents, gallery and learning resources.

## PHASE 12 — KV
Cache/temporary values/verification/rate-limit support. Never move authoritative records to KV.

## PHASE 13 — Reporting/Polish
Report cards, search, filters, dashboards, exports, accessibility and tablet optimization.

## PHASE 14 — Staging
Deploy staging Worker, D1, R2, KV and domain/subdomain. Run acceptance tests.

## PHASE 15 — Production Readiness
Verify security, auth, RBAC, payments, migrations, recovery procedures, storage, domain, logging, privacy and training.

## PHASE 16 — Production
Deploy production Worker/D1/R2/KV/domain and run smoke tests for every role and critical workflow.

## 2. AI Operating Rules
Inspect before modifying. Preserve compatible functionality. Never invent rules. Never add infrastructure without approval. Never create duplicate docs. Never expose secrets. Use migrations. Enforce authorization server-side. Test changes. Report unresolved issues. Update the master docs when architecture changes.

## 3. Git
After stable phases:
```bash
git status
git add .
git commit -m "..."
git push
```
GitHub is source control, not deployment.

## 4. Deployment
Development: local. Staging: Wrangler → Cloudflare staging. Production: Wrangler → Cloudflare production.

## 5. Definition of Done
Implementation exists, UI works, migrations work, authorization is tested, errors are handled, architecture is compliant, docs reflect reality and progress is committed.

## 6. First Implementation Task
Read all seven specification documents, inspect the repository, compare current architecture with target architecture, populate the migration/gap report, identify reusable/rewrite/remove items and risks, then STOP before destructive changes and present findings for owner approval.
