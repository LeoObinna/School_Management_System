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
- PostgreSQL stores metadata; R2 stores objects

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
