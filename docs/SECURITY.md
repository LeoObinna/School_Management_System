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

Never log: passwords, tokens, API/R2 secrets, private keys, card data,
Resend/Termii API keys, email message bodies, SMS text beyond 160 chars.

## Rate limiting

- Login: throttled per IP + per user
- API: rate-limited per authenticated user
- File uploads: rate-limited per user + per category
- Newsletter subscribe: 5 requests / 5 min per IP (sliding window)
- Cloudflare WAF rules at the edge for additional protection

## Data privacy

- Collect only necessary school data
- No real student data in development or staging
- No private data in URLs
- Access restricted by role/permission
- Sensitive operations audited

## Email / SMS providers (Phase 17)

- **Resend** (email): API key travels only in the `Authorization: Bearer`
  header. Never logged, never included in error messages. 4xx errors are
  permanent (bad key, invalid address) — not retried. 5xx errors retried
  once. The queue consumer applies its own retry policy on top.
- **Termii** (SMS): API key travels in the JSON request body (per
  Termii's API spec). Never logged. Same retry semantics as Resend.
- **Delivery tracking**: every external send is recorded in
  `notification_deliveries` with `status` (pending/sent/bounced/failed),
  `provider_message_id`, and `error_message`. Idempotency: if a `sent`
  row already exists for the same notification + channel + recipient,
  the message is not re-sent.
- **Per-user preferences**: users can opt out of each channel/event via
  `PATCH /api/v1/me/notification-preferences`. Defaults are all-true.
- **Newsletter**: public subscribe/unsubscribe endpoints are
  unauthenticated but rate-limited. Unsubscribe is by email only (no
  token — the email is not sensitive; a confirmation is returned).
- **No secrets in wrangler.toml**: `RESEND_API_KEY`,
  `SEND_FROM_EMAIL`, `TERMII_API_KEY`, `TERMII_SENDER_ID` are read from
  `.dev.vars` (local) or `wrangler secret put -e production` (prod).
  They are never committed.
- **Queue safety**: malformed messages are acked as poison (no retry
  loop). Transient DB failures trigger `message.retry()` (at-least-once
  delivery; idempotent fan-out via partial unique index on
  `(user_id, announcement_id)` and link-marker dedupe for non-announcement
  types).
- **No tracking pixels**: no email open-rate tracking. No SMS
  delivery-report callbacks.
