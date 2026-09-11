# Migration Plan — Nuxt + Cloudflare

**Project:** Victorious Children School SMS
**Status:** PROPOSED — pending project owner approval
**Decision:** See `ARCHITECTURE_DECISION_RECORD.md`

This plan covers the migration from the approved (but unbuilt) Laravel
backend to a Nuxt 3 + Cloudflare Workers application. PostgreSQL is
retained. The existing Vue 3 frontend scaffold is adapted to Nuxt.

---

## Guiding Principles

1. **No destructive changes.** The existing `frontend/` directory and
   all docs remain until the Nuxt app reaches feature parity.
2. **One phase at a time.** Each phase is a separate, reviewable PR.
3. **PostgreSQL is non-negotiable.** No D1 for primary data.
4. **Server-side authorization is authoritative.** Frontend guards are
   UX only.
5. **Types and validation are shared.** zod schemas and TS types live
   in `shared/`.
6. **Business rules from README survive unchanged.** Academic
   structure, finance, attendance, results, admissions.

---

## Migration Complexity Summary

| Area               | Complexity | Reason                                                |
|--------------------|------------|-------------------------------------------------------|
| Frontend           | MEDIUM     | Vue → Nuxt conventions; components reusable           |
| Backend            | LOW        | No Laravel backend exists — build fresh in Nitro      |
| Database           | N/A        | No schema exists — design fresh with Drizzle          |
| Auth/RBAC          | LOW        | Build fresh                                           |
| Tests              | LOW        | Build fresh (Vitest unified)                          |
| Deployment         | MEDIUM     | Workers + R2 + Hyperdrive + Queues setup              |

**Overall risk: LOW-MEDIUM.**

---

## Phase 0 — Git Checkpoint & Nuxt Scaffold

**Goal:** Create a safe starting point and the Nuxt foundation.

Steps:
1. Tag current `main` as `pre-nuxt-migration`.
2. Create a new directory `app/` (Nuxt app) alongside `frontend/`.
3. Scaffold Nuxt 3 with TypeScript:
   - `npx nuxi@latest init app`
   - Add dependencies: `pinia`, `@pinia/nuxt`, `drizzle-orm`,
     `drizzle-kit`, `zod`, `@nuxtjs/tailwindcss` (or Tailwind v4),
     `vue-router` (Nuxt built-in), `wrangler` (dev dependency).
4. Configure `nuxt.config.ts`:
   - `preset: 'cloudflare-pages'` or `cloudflare-module`
   - TypeScript strict mode
   - Pinia, Tailwind modules
5. Configure Drizzle with PostgreSQL:
   - `drizzle.config.ts`
   - `database/schema/` directory
6. Configure wrangler for Workers + R2 bindings:
   - `wrangler.toml` with R2 bucket binding, Hyperdrive binding
7. Update `.devcontainer/devcontainer.json`:
   - Remove PHP feature
   - Keep PostgreSQL 16 service
   - Remove Redis (or keep for dev; not needed in prod)
   - Add wrangler install to post-create
8. Update `ci.yml`: single Nuxt job (type-check, test, build, deploy).
9. Verify: `npm run dev` starts Nuxt on :3000; connects to PostgreSQL.

**Acceptance:** Nuxt app runs, connects to PostgreSQL, Tailwind works,
Pinia works, CI passes.

---

## Phase 1 — Database Foundation & Shared Types

**Goal:** Establish the database schema, ORM, and shared type layer.

Steps:
1. Define Drizzle schema for all tables per README §12 (follow
   migration order in README §40):
   - users, roles, permissions, role_permissions, user_roles,
     school_settings
   - academic_sessions, terms, classes, sections, subjects,
     class_subjects
   - students, parents, teachers, staff_profiles, student_parents
   - teacher_subjects, teacher_class_assignments, student_enrollments
   - timetable_entries
   - attendance_sessions, attendance_records
   - assignments, assignment_attachments, assignment_submissions
   - assessment_types, exams, exam_subjects, grading_scales,
     grading_scale_items
   - assessment_scores, exam_scores, result_publications, report_cards
   - fee_structures, fee_items, student_invoices, invoice_items,
     payments, payment_receipts
   - admission_applications, admission_documents, admission_assessments
   - announcements, notifications, messages
   - events, gallery_albums, gallery_images
   - audit_logs
2. Use `NUMERIC` for all money columns. Foreign keys on all
   relationships. Meaningful unique constraints.
3. Create Drizzle migrations.
4. Run migrations against the Codespace PostgreSQL.
5. Create `shared/types/` — TypeScript interfaces for all entities
   (derived from Drizzle schema).
6. Create `shared/schemas/` — zod validation schemas for create/update
   operations.
7. Create `shared/constants/` — enums (attendance statuses, result
   workflow states, student lifecycle, etc.).
8. Seed database with fake demo data (roles, permissions, users,
   sessions, terms, classes, subjects).

**Acceptance:** Schema migrated, seed data present, types compile,
CI passes.

---

## Phase 2 — Authentication & RBAC

**Goal:** Secure auth and authorization foundation.

Steps:
1. Implement user model with password hashing (bcrypt/argon2).
2. Implement login/logout endpoints in `server/api/v1/auth/`:
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/auth/me`
   - `POST /api/v1/auth/forgot-password`
   - `POST /api/v1/auth/reset-password`
3. Session strategy: signed HTTP-only cookies (Secure, SameSite=Lax).
   Optionally KV-backed server sessions for revocation.
4. CSRF protection for state-changing requests.
5. `server/middleware/auth.ts` — validate session on protected routes.
6. `server/middleware/rbac.ts` — permission checks via a composable
   `requirePermission('students.create')`.
7. Roles & permissions tables (from Phase 1 seed).
8. Password reset with signed tokens.
9. Audit logging for auth events.
10. Tests: login success/failure, session expiry, permission denial,
    role isolation, parent-child isolation.

**Acceptance:** Auth works end-to-end; RBAC enforces permissions
server-side; tests pass.

---

## Phase 3 — Frontend Foundation in Nuxt

**Goal:** Adapt the existing Vue 3 scaffold to Nuxt conventions.

Steps:
1. Move UI components to `app/components/` (auto-imported):
   - `BaseButton`, `BaseBadge`, `BaseCard`
2. Create `app/layouts/default.vue` from `AppLayout.vue`.
3. Convert router to file-based pages in `app/pages/`:
   - `index.vue` (dashboard)
   - `system-health.vue`
   - `auth/login.vue`
   - `[...slug].vue` (404)
4. Move Pinia stores to `app/stores/` (or use `@pinia/nuxt`).
5. Create `app/middleware/auth.ts` (client-side UX guard).
6. Set up `app/services/api.ts` using `$fetch` or the existing axios
   client with `useRuntimeConfig` for base URL.
7. Move shared types to `shared/types/`.
8. Apply Tailwind design system (from README §9).
9. Build dashboard shell with sidebar navigation (role-based).
10. Tests: component tests, store tests, route guard tests.

**Acceptance:** Nuxt frontend renders, auth redirect works, dashboard
shell displays per role.

---

## Phase 4 — Academic Core

**Goal:** Sessions, terms, classes, sections, subjects, class subjects,
teacher assignments.

Steps:
1. Server routes for:
   - academic_sessions (CRUD)
   - terms (CRUD)
   - classes (CRUD)
   - sections (CRUD)
   - subjects (CRUD)
   - class_subjects (assign)
   - teacher_assignments (assign)
2. Validation with zod schemas.
3. Authorization via `requirePermission`.
4. Frontend pages: manage sessions/terms/classes/subjects.
5. Tests: CRUD, validation, authorization, constraints.

---

## Phase 5 — People & Enrollment

**Goal:** Students, parents, teachers, staff, parent-child links,
enrollment, student lifecycle.

Steps:
1. Server routes: students, parents, teachers, staff, student_parents,
   enrollments.
2. Student lifecycle: Applicant → Admitted → Enrolled → Active →
   Graduated/Transferred/Withdrawn/Archived.
3. Parent-child linking (server-side enforced).
4. Enrollment with historical context (session, term, class, section).
5. Frontend pages: student list/detail, parent linking, enrollment.
6. Tests: lifecycle transitions, parent-child isolation, historical
   enrollment preservation.

---

## Phase 6 — Timetable & Attendance

**Goal:** Timetable with conflict detection; attendance marking.

Steps:
1. Timetable entries with conflict detection:
   - teacher not in two classes simultaneously
   - class not in two subjects simultaneously
   - room not double-booked
2. Attendance sessions + records.
3. Attendance statuses: present, absent, late, excused.
4. Prevent duplicate attendance records (unique constraint).
5. Attendance approval workflow.
6. Frontend: timetable view, attendance marking sheet.
7. Tests: conflict detection, duplicate prevention, approval.

---

## Phase 7 — Assignments & Resources

**Goal:** Assignments, submissions, grading, learning resources, R2.

Steps:
1. Assignments CRUD + publish workflow.
2. Submissions (student upload to R2).
3. Grading submissions.
4. Resources (R2 upload + metadata in PG).
5. R2 integration: presigned URLs, private file access.
6. Frontend: assignment list, submission upload, grading.
7. Tests: R2 upload, file access authorization, grading.

---

## Phase 8 — Exams, Results & Report Cards

**Goal:** Assessment types, exams, scores, grading scales, result
workflow, report cards.

Steps:
1. Assessment types, exams, exam subjects.
2. Scores entry (assessment_scores, exam_scores).
3. Configurable grading scales (grading_scales + items).
4. Result workflow: Draft → Submitted → Approved → Published.
5. Students/parents see only published results.
6. Report cards: generate, preview, publish, PDF, print.
7. PDF generation via Cloudflare Queue (exceeds Worker CPU limit).
8. Frontend: score entry, result approval, report card view.
9. Tests: grading calculation, workflow states, visibility rules.

---

## Phase 9 — Finance

**Goal:** Fees, invoices, payments, verification, receipts.

Steps:
1. Fee structures + items.
2. Invoices + invoice items.
3. Payments + verification + receipts.
4. Exact decimal arithmetic (NUMERIC).
5. Payment webhook verification + idempotency.
6. Outstanding balances, financial reports.
7. R2 for receipt PDFs.
8. Frontend: fee structure, invoices, payments, receipts.
9. Tests: money precision, invoice→payment→receipt flow, webhook
   verification, idempotency.

---

## Phase 10 — Admissions

**Goal:** Application → documents → review → assessment → decision →
admission → enrollment.

Steps:
1. Admission applications.
2. Admission documents (R2 upload).
3. Admission assessments/interviews.
4. Review, decision (approve/reject).
5. Admission → enrollment transition.
6. Frontend: application pipeline.
7. Tests: workflow states, document access, enrollment transition.

---

## Phase 11 — Communication, Events & Gallery

**Goal:** Announcements, notifications, messaging, events, gallery.

Steps:
1. Announcements (draft/scheduled/published/archived).
2. Notifications (Cloudflare Queues for bulk).
3. Messaging (controlled).
4. Events.
5. Gallery albums + images (R2).
6. Frontend pages for each.
7. Tests: workflow states, audience targeting, R2 access.

---

## Phase 12 — Reports, Exports & Audit

**Goal:** Operational reports, exports, audit log UI.

Steps:
1. Reports: attendance, results, finance, admissions.
2. Exports (CSV/PDF) via Cloudflare Queues.
3. Audit log viewing (filtered).
4. Frontend: reports dashboard, audit log viewer.
5. Tests: report accuracy, export generation.

---

## Phase 13 — Hardening

**Goal:** Security, performance, accessibility, rate limiting.

Steps:
1. Security review: no secrets, secure headers, CSRF, rate limiting.
2. Performance: pagination, indexes, eager loading, caching where
   justified.
3. Accessibility: semantic HTML, keyboard nav, focus states, contrast.
4. Cloudflare WAF rules, rate limiting on auth endpoints.
5. File upload validation (type, MIME, size, authorization).
6. Audit logging completeness.
7. Tests: security, authorization boundaries, file access.

---

## Phase 14 — Testing & Security Hardening

**Goal:** Comprehensive test coverage and security verification.

Steps:
1. Unit tests: services, repositories, utilities.
2. Integration tests: server routes, auth/RBAC, workflows.
3. E2E tests (Playwright): login, student CRUD, parent linking,
   attendance, results, finance, admissions, report cards, file
   upload, private file access.
4. Authorization matrix test (every role × every permission).
5. Security checklist (README §34 / master prompt Part 34).
6. Load test for concurrent result entry and payments.

---

## Phase 15 — Staging Deployment

**Goal:** Deploy to Cloudflare Workers staging.

Steps:
1. Configure `wrangler.toml` for staging environment.
2. Set up staging managed PostgreSQL (Neon/Supabase).
3. Set up staging R2 bucket (`sms-staging`).
4. Set up Cloudflare Hyperdrive for staging PG.
5. Set up Cloudflare Queues.
6. Set Codespace/GitHub secrets for staging.
7. Deploy via CI (`wrangler deploy`).
8. Verify: health check, login, CRUD, R2 upload, email.
9. Run staging test suite.

---

## Phase 16 — Data Verification

**Goal:** Verify data integrity and business rule compliance.

Steps:
1. Verify row counts match expectations.
2. Verify foreign key integrity.
3. Verify indexes and constraints.
4. Verify money precision (no floating point errors).
5. Verify historical records preserved.
6. Run financial reconciliation reports.
7. Verify audit logs complete.

---

## Phase 17 — Production Cutover

**Goal:** Go live.

Steps:
1. Set up production PostgreSQL, R2 bucket (`sms-production`),
   Hyperdrive, Queues.
2. Configure Cloudflare DNS, TLS (Full strict), WAF.
3. Deploy production Workers.
4. Run final security checklist.
5. Back up production database.
6. Cut over DNS.
7. Monitor logs, errors, performance.
8. Document rollback procedure.

---

## Rollback Strategy

- **During migration:** Existing `frontend/` and docs remain. The Nuxt
  app lives in `app/`. Rollback = delete `app/` and revert.
- **After cutover:** Keep previous stack's last known-good deployment
  for 30 days. Database backups enable point-in-time restore.
- **Database:** PostgreSQL is unchanged between old and new stack
  (both use PG), so data rollback is trivial.

---

## Parallel / Strangler Approach

The old Laravel backend was never built, so there is no "strangler"
target. The Vue 3 `frontend/` remains in the repo as reference until
the Nuxt app reaches feature parity, then is removed.

---

## Testing Gates (per phase)

Every phase must pass:

- **Functional:** happy path, validation, error states
- **Authorization:** authorized succeeds, unauthorized fails,
  cross-user fails, cross-role fails
- **Database:** migrations work, constraints work, relationships work,
  historical records intact
- **Frontend:** loading/empty/error/success states, responsive,
  TypeScript checks
- **E2E (critical):** login, role restrictions, student creation,
  enrollment, attendance, result entry/approval/publication,
  parent result viewing, invoice, payment verification, receipt,
  file upload, private file access

---

## Items Preserved Across Migration

- PostgreSQL database design (README §12)
- All business rules (README §13–§22)
- Permission model (README §8)
- Role definitions (README §7)
- API conventions (README §24)
- Security principles (docs/SECURITY.md)
- R2 storage strategy (README §23)
- Audit logging requirements (README §26)
- Historical record preservation
- No real student data in dev/staging
- No secrets in code

---

*Migration will only begin after explicit project owner approval.
See `ARCHITECTURE_DECISION_RECORD.md` for the approval phrase.*
