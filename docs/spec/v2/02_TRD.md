# VICTORIOUS CHILDREN SCHOOL — TECHNICAL REQUIREMENT DOCUMENT (TRD)

**Version:** 2.0  
**Architecture:** Cloudflare-first

## 1. Authoritative Architecture
```text
TRAE
  |
  +-- Nuxt 4 / Vue 3 / TypeScript / Tailwind
  +-- Wrangler
          |
          v
Cloudflare Worker
  |
  +-- D1  -> database
  +-- R2  -> files
  +-- KV  -> cache/temporary data
  +-- Static Assets
  +-- DNS/domain
```

Cloudflare Pages must not be introduced as a second application runtime unless explicitly required. Preferred deployment is a Worker serving the Nuxt application and static assets.

## 2. Technology Stack
- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS
- Nitro
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Cloudflare KV
- Wrangler
- Cloudflare DNS/domain
- Git/GitHub
- Paystack

## 3. Local Development
Required: macOS, TRAE, Node.js, npm, Git and Wrangler.

Avoid Docker, Codespaces, PHP, Apache, Nginx, local PostgreSQL, local MySQL and Herd unless explicitly approved. Use Wrangler's local D1 development capabilities.

## 4. Environments
Maintain conceptual separation between Development, Staging and Production, with separate D1/R2/KV resources.

## 5. D1 Database Rules
D1 is the authoritative application database.

Design for SQLite/D1 instead of copying PostgreSQL syntax:
- TEXT IDs where appropriate.
- Application-generated UUID-like IDs if desired.
- INTEGER minor currency units.
- TEXT + CHECK instead of PostgreSQL enums.
- One consistent timestamp representation.
- Foreign keys and deliberate indexes.
- No PostgreSQL-only extensions/types.
- Avoid unsupported transaction/query assumptions.
- Deterministic migrations.

Example role:
```sql
role TEXT NOT NULL CHECK (role IN ('admin','teacher','student','parent'))
```

Money:
```sql
amount INTEGER NOT NULL
```
₦150,000.00 = 15,000,000 kobo.

## 6. Existing Project Migration
First inspect the repository, stack, PostgreSQL-specific code, routes, UI, auth, payment logic, Cloudflare configuration and documentation. Produce a migration/gap report before destructive changes.

## 7. PostgreSQL-to-D1 Review
Explicitly inspect enums, UUIDs, NUMERIC, timestamps, SQL, drivers, transactions, indexes, constraints, migrations, seed scripts and tests. No PostgreSQL dependency should remain in the final architecture unless explicitly approved for a separate purpose.

## 8. Worker Responsibilities
Serving app, API requests, authentication, authorization, D1/R2/KV access, payment verification, validation and security controls.

## 9. Authentication
Secure password hashing, sessions, HttpOnly/Secure/SameSite cookies where appropriate, expiration, logout/revocation, password reset, throttling and account status.

## 10. RBAC
Roles: Admin, Teacher, Student, Parent. Use granular permissions such as:
`students.read`, `students.create`, `students.update`, `students.archive`, `attendance.read`, `attendance.create`, `attendance.update`, `results.enter`, `results.submit`, `results.approve`, `results.publish`, `fees.read`, `payments.verify`, `users.manage`, `audit.read`.

Server-side authorization is mandatory.

## 11. R2
R2 stores actual files. D1 stores metadata. Private files must remain protected by authorization.

## 12. KV
KV is not the primary database. Use it for cache, short-lived values, verification/rate-limit support and other non-authoritative data.

## 13. Payments
```text
Parent -> Worker -> Paystack -> webhook -> verification -> D1 -> fee ledger -> receipt
```
Never trust the browser callback alone. Payment records must be idempotent and auditable.

## 14. API
Use clear route groups:
`/api/auth/*`, `/api/students/*`, `/api/parents/*`, `/api/teachers/*`, `/api/classes/*`, `/api/subjects/*`, `/api/attendance/*`, `/api/results/*`, `/api/fees/*`, `/api/payments/*`, `/api/admissions/*`, `/api/assignments/*`, `/api/announcements/*`, `/api/documents/*`, `/api/admin/*`.

## 15. Validation
Validate bodies, query/route parameters, uploads, payment references and user content. Server validation is authoritative.

## 16. Performance
Optimize images, client JavaScript, pagination and indexed queries. Cache public data where appropriate.

## 17. Accessibility
Target WCAG 2.1 AA principles where practical.

## 18. Observability
Use structured errors, audit events, payment event logging and deployment/version identification. Never log secrets.

## 19. Testing
Test authentication, RBAC, student/parent/teacher boundaries, migrations, fee calculations, payment verification, result workflow, file authorization and critical UI/API routes.

## 20. Bindings/Secrets
Use Cloudflare bindings for D1/R2/KV and secrets for Paystack/session/private credentials. Never commit production secrets.

## 21. Deployment
Manual deployment from TRAE:
```bash
npx wrangler deploy
```
GitHub is source control, not deployment.

## 22. Technical Non-Goals
Do not add PostgreSQL/Neon/Hyperdrive, Docker, Kubernetes, microservices, duplicate databases, duplicate backends or duplicate documentation without explicit approval.
