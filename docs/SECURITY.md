# Security

## Principles

1. **Server-side authorization is authoritative.** Frontend route guards are UX only.
2. **Never trust client-supplied roles, permissions or payment status.**
3. **Never expose internal SQL, stack traces or sensitive errors.**
4. **Never log passwords, tokens, API/R2 secrets, private keys or card data.**
5. **Least-privilege database accounts** in staging/production.

## Authentication

- Laravel Sanctum (cookie-based SPA auth + token API)
- Throttling on login (rate limit per IP + per user)
- Strong password rules (min length, complexity)
- Password hashing (bcrypt/argon2)
- Optional email verification
- 2FA-ready architecture
- Session security (timeout, regeneration)

## Authorization

- Policies/Gates for every resource (README §8 permissions)
- Explicit permission names, not scattered role checks
- Parent-child access enforced server-side through authenticated parent's links
- Teacher access scoped to assigned classes/subjects only

## Transport

- HTTPS everywhere (enforced by Cloudflare)
- Full (strict) TLS at Cloudflare edge
- Secure cookies (HttpOnly, Secure, SameSite)
- CSRF protection for cookie-based auth

## File security

- Private files stored in R2, served through authorized backend access
  or temporary presigned URLs
- Server-side validation of uploads: type, MIME, size, category, authorization
- Safe object key generation (never trust client filenames)
- D1 stores metadata; R2 stores objects

## Secrets management

| Environment | Method                                |
|-------------|---------------------------------------|
| Local dev   | gitignored `app/.env` only            |
| Staging     | `wrangler secret put -e staging` (or dashboard) |
| Production  | `wrangler secret put -e production` (or dashboard) |

There is no Codespace and no CI secret store. `.env.example` is the only
env file that may be committed; `.gitignore` blocks `.env`, `.dev.vars`
and credential files (`*.pem`, `*.key`, `*.crt`). Secrets are never
placed in `wrangler.toml`.

## Payment gateway (Phase 15)

- **The browser callback never verifies a payment.** Both the callback
  page (`POST /payments/paystack/verify`) and the webhook re-verify
  server-side against Paystack and require exact kobo amount match,
  `currency == NGN` and `status == success` before any accounting runs.
- Webhook authentication is the `x-paystack-signature` HMAC-SHA512 hex
  of the raw request body (timing-safe compare, fail-closed — bad
  signature → 403, unconfigured key → 409). The route is intentionally
  outside CSRF/session middleware; the signature is its only guard.
- Idempotency: `payments.idempotency_key = paystack:{reference}` plus a
  status guard make webhook/callback replays no-ops.
- `PAYSTACK_SECRET_KEY` lives only in `app/.env` (local) or
  `wrangler secret put` (deployed); it is injected per request and never
  ships in the client bundle or appears in logs.
- School bank details (used by the bank-transfer QR and receipts) are
  served only to authenticated users holding `payments.view`.

## Role portals (Phase 16)

- **The login redirect by primary role (student/parent/teacher →
  `/portal/*` homes) is UX only.** Authorization stays fully
  server-side: every portal endpoint re-checks the session and
  permission (`requirePermission` + `resolveActorProfile`), so a
  hand-crafted request without the right permission fails with 401/403
  regardless of which page issued it. Business ids (studentId,
  parentId, teacherId, ward list) are always resolved from the actor —
  never accepted from the client.
- **Per-row CSV authorization in bulk score entry
  (`/exam-results/bulk-preview` / `/bulk`):** each CSV row is checked
  individually against the acting teacher's class-level and
  per-subject/section assignments; an unassigned subject is rejected
  for that row only (`403`-equivalent per-row error, HTTP 200 with
  `ok: false`) so one unauthorized row cannot fail or bypass the whole
  file. Duplicate detection keys only rows that would actually be
  committed.
- **Lesson notes are ownership-scoped:** teachers read/manage only
  their own notes; admins read/manage all but cannot author; other
  staff get an empty list; out-of-scope reads (including probing by id)
  return the same 404 as a missing note — existence is never revealed.
  Parents have no `lesson_notes.*` permission and get 403 at the gate.
- **Lesson-note attachments are private:** uploads are magic-byte
  validated (25 MB cap) and stored under the R2 `lesson-notes/` prefix
  with generated object keys (client filename never trusted). Downloads
  stream through the authorized route
  (`GET /lesson-notes/{id}/files/{fileId}`, `lesson_notes.view` +
  note-scope check) with `no-store` semantics — never a public r2.dev
  URL; parent download attempts are rejected at the permission gate.
  Metadata deletes only proceed when R2 is reachable, so metadata and
  bytes do not diverge.

## Audit logging

Audit: auth events, role/permission changes, student/enrollment edits,
attendance edits, score changes, result approval/publication,
invoice/payment/refund changes, admission decisions, file access,
settings changes.

Never log: passwords, tokens, API/R2 secrets, private keys, card data.

## Rate limiting

- Login: throttled per IP + per user
- API: rate-limited per authenticated user
- File uploads: rate-limited per user + per category
- Cloudflare WAF rules at the edge for additional protection

## Data privacy

- Collect only necessary school data
- No real student data in development or staging
- No private data in URLs
- Access restricted by role/permission
- Sensitive operations audited
