# Phase 10 — Paystack Finance (Net-New)

## Context

Per the v2.0 spec package (`06_IMPLEMENTATION_PLAN.md` Phase 10 line 47–49, `02_TRD.md` §13, `04_APPFLOW.md` §10, `01_PRD.md` §5), Phase 10 builds the Paystack online-payment integration net-new. The existing finance layer (Phase 4b, commit `40dcc83`) already has:

- `payments` table with reserved columns `providerReference`, `idempotencyKey`, `webhookPayload`, `paidAt`, `verifiedAt`, `refundedAt` — [finance.ts#L166-L211](file:///Users/mac/Documents/School_Management_System/app/database/schema/finance.ts#L166-L211)
- `payments_idempotency_idx` UNIQUE index on `idempotencyKey` (duplicate webhooks fail on insert — idempotent by DB design)
- `paymentMethodEnum` includes `online_gateway` (no enum change needed)
- `paymentStatusEnum` = `pending, verified, failed, refunded`
- `recordPayment` / `verifyPayment` / `refundPayment` service functions — [finance.ts#L1255-L1470](file:///Users/mac/Documents/School_Management_System/app/server/services/finance.ts#L1255)
- Existing routes: `POST /payments`, `GET /payments`, `GET /payments/:id`, `POST /payments/:id/verify`, `POST /payments/:id/refund`, `GET /payments/:id/receipt` — [app/server/api/v1/payments/](file:///Users/mac/Documents/School_Management_System/app/server/api/v1/payments)
- Money is INTEGER kobo end-to-end (Phase 4b done)
- D1-only runtime (Phase 3 done); local dev via `wrangler dev`/getPlatformProxy

**What's missing (Phase 10 scope):** Paystack initialize, webhook receiver with HMAC verification, manual verify fallback, parent-facing UI button, idempotent webhook handler, env vars, tests, docs.

**Out of scope:** Paystack inline-JS popup (we use standard redirect), webhook→verifyTransaction API call (we trust HMAC-only), production secrets, staging cutover (Phase 14), bank-transfer details (owner-approved bank details are a separate `school_settings` decision, deferred).

## Design Decisions (locked-in by owner 2026-09-23)

1. **Scope = Backend + parent-facing UI**: build the Paystack backend AND add a parent "Pay with Paystack" button on the parent's billing/invoices view. Adds a new RBAC slug `payments.paystack.init` granted to the `parent` role.
2. **Standard redirect**: Worker calls `POST https://api.paystack.co/transaction/initialize` → returns `authorization_url` → browser redirects there → user pays on Paystack → browser redirects back to `/payments/callback` (a status-only page) → meanwhile Paystack fires webhook to `/api/v1/paystack/webhook` which finalizes the payment.
3. **HMAC-only verification**: when webhook fires, verify `x-paystack-signature` HMAC-SHA512 with `PAYSTACK_WEBHOOK_HASH_SECRET`; if valid, parse payload, find the pending payment by `providerReference`, promote to `verified`, update invoice balance, generate receipt. No call to Paystack verify endpoint.
4. **Idempotency by DB constraint**: webhook handler sets `idempotencyKey = 'paystack:' + reference`. Replays hit the UNIQUE index → caught as `isUniqueViolation` → return 200 silently. Paystack requires 200 even for duplicates.
5. **Local testing**: Paystack TEST keys in `.env` (gitignored). Webhook e2e via `cloudflared tunnel --url http://localhost:8787`. Manual verify endpoint as fallback.
6. **No production secrets**: never commit keys; document `wrangler secret put PAYSTACK_SECRET_KEY -e staging|production` for staging/prod (do NOT run that as part of Phase 10 — staging stays PG, untouched).

## Files to Create / Modify

### New files (Paystack net-new)

| Path | Purpose |
|---|---|
| `app/server/utils/paystack.ts` | Paystack HTTP client + HMAC verifier. Exports `initializeTransaction()`, `verifyWebhookSignature()`. Uses WebCrypto (`crypto.subtle`) + `fetch`. Reads `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_HASH_SECRET`, `PAYSTACK_BASE_URL` (default `https://api.paystack.co`) from runtime config. |
| `app/server/api/v1/payments/paystack/initialize.post.ts` | Parent/admin initiates payment. Body: `{ invoiceId }`. Calls `initializePaystackPayment()` service → returns `{ authorizationUrl, reference }`. Permission: `payments.paystack.init`. |
| `app/server/api/v1/paystack/webhook.post.ts` | Webhook receiver. NO auth middleware (excluded by route group). Reads raw body + `x-paystack-signature` header → `handlePaystackWebhook()` service. Returns 200 always (Paystack requirement). |
| `app/server/api/v1/payments/[id]/paystack-verify.post.ts` | Manual fallback: admin triggers webhook replay simulation OR calls Paystack verify endpoint. Permission: `payments.verify`. Used when webhook fails / cloudflared tunnel down. |
| `app/pages/payments/callback.vue` | Status-only page Paystack redirects to. Reads `?reference` & `?status` query, shows success/pending message, links back to `/billing`. No state mutation (webhook is source of truth). |
| `app/server/services/__tests__/finance.paystack.test.ts` | Unit tests for Paystack service functions (initialize, webhook handler, idempotency, HMAC verify, parent-scope check, duplicate payment protection). Uses mocked `fetch` + stub Paystack payloads. |
| `app/server/utils/__tests__/paystack.test.ts` | Unit tests for HMAC verifier + URL builder. |

### Modified files

| Path | Change |
|---|---|
| [app/server/services/finance.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/finance.ts) | Add `initializePaystackPayment(input, actor)`, `handlePaystackWebhook(rawBody, signature)`, `manualVerifyPaystackPayment(id, actor)`. Reuse `getFinanceActor`, `getPayment`, `runDocNumberBatch`, `receiptInsert`, `invoicePaymentStatus`, `isUniqueViolation`, `smsConflict`. Parent-scope check: `actor.childIds.includes(invoice.studentId)`; staff-scope: `actor.isStaff`. |
| [app/shared/schemas/finance.ts](file:///Users/mac/Documents/School_Management_System/app/shared/schemas/finance.ts) | Add `paystackInitializeSchema = z.object({ invoiceId: uuidSchema })`. Export `PaystackInitialize` type. |
| [app/shared/types/index.ts](file:///Users/mac/Documents/School_Management_System/app/shared/types/index.ts) | Add `PaystackInitializeResult = { authorizationUrl: string; reference: string; paymentId: string }`. |
| [app/database/seeds/catalog.ts](file:///Users/mac/Documents/School_Management_System/app/database/seeds/catalog.ts) | Add `payments.paystack.init` slug to parent role permission catalog. Add to seed idempotent upsert (chunked — D1 100-bind limit). |
| [app/middleware/auth.global.ts](file:///Users/mac/Documents/School_Management_System/app/middleware/auth.global.ts) (or wherever the global guard lives) | Whitelist `/api/v1/paystack/webhook` from session auth (HMAC is the auth). Read this file first to confirm the bypass mechanism. |
| [app/pages/billing.vue](file:///Users/mac/Documents/School_Management_System/app/pages/billing.vue) | Add "Pay with Paystack" button on each outstanding invoice row (parent view only). On click → POST `/api/v1/payments/paystack/initialize` → redirect window to `authorizationUrl`. Show pending/verified state inline. |
| [app/pages/finance/invoices.vue](file:///Users/mac/Documents/School_Management_System/app/pages/finance/invoices.vue) | Admin view: show "Paystack" badge on online-gateway payments + "Replay webhook / Manual verify" action when status is `pending` and method is `online_gateway`. |
| [app/wrangler.toml](file:///Users/mac/Documents/School_Management_System/app/wrangler.toml) | Document (comment-only) the secrets needed: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_HASH_SECRET`. NO actual values. Local dev uses `[vars]` placeholder; actual test keys via `.env`/`.dev.vars`. |
| [app/.env.example](file:///Users/mac/Documents/School_Management_System/app/.env.example) | Add `PAYSTACK_SECRET_KEY=`, `PAYSTACK_WEBHOOK_HASH_SECRET=`, `PAYSTACK_BASE_URL=https://api.paystack.co`, `PAYSTACK_CALLBACK_URL=http://localhost:3000/payments/callback`. Document that production uses `wrangler secret put`. |
| [app/nuxt.config.ts](file:///Users/mac/Documents/School_Management_System/app/nuxt.config.ts) | Add `runtimeConfig.paystack = { secretKey, webhookHashSecret, baseUrl, callbackUrl }` — same pattern as existing `runtimeConfig.sessionSecret`. Wire from env in the `request` plugin (where existing secrets are bridged). |
| [README.md](file:///Users/mac/Documents/School_Management_System/README.md) §51 | Add Phase 10 changelog entry (env vars, routes, permissions, tests, limitations). |

## Implementation Steps

1. **Schemas + types** (no behavior change, type-safe): add `paystackInitializeSchema`, `PaystackInitializeResult`.
2. **Paystack client util** (`server/utils/paystack.ts`): pure functions, fully testable. Implement `initializeTransaction()` and `verifyWebhookSignature()`. Use `crypto.subtle.importKey` + `sign` HMAC-SHA512. Use `fetch` with `Authorization: Bearer ${secretKey}`. Return typed shapes.
3. **Service functions** in `server/services/finance.ts`:
   - `initializePaystackPayment(input: PaystackInitialize, actor: FinanceActor)`: parent → load invoice → check `actor.childIds.includes(invoice.studentId)` → check invoice status ∈ {`issued`, `partially_paid`} → check balance > 0 → create `pending` payment with `method: 'online_gateway'`, `providerReference = 'VCS-' + paymentId.slice(0,8) + '-' + Date.now()` (Paystack ref max 100 chars) → call `initializeTransaction` → return `{ authorizationUrl, reference: providerReference, paymentId }`. Staff with `payments.record` can also initiate on behalf.
   - `handlePaystackWebhook(rawBody: string, signature: string)`: verify HMAC → if invalid return `{ok:false,reason:'bad-signature'}` (route still returns 200). Parse event: only handle `charge.success` (skip others — return `{ok:true,skipped:true}`). Find payment by `providerReference === data.reference`. If not found → `{ok:true,skipped:true}` (Paystack may send webhook for transactions we didn't initiate — return 200 silently). If found and already `verified` → idempotent return. If found and `pending` → set `idempotencyKey='paystack:'+reference`, `webhookPayload=rawBody`, `status='verified'`, `paidAt`, `verifiedAt`, `verifiedById=null` (system) → batch with invoice update + receipt insert (mirror existing `verifyPayment`). Catch `isUniqueViolation` → idempotent replay, return `{ok:true,replayed:true}`.
   - `manualVerifyPaystackPayment(id, actor)`: admin fallback. Loads payment, asserts `method === 'online_gateway'` and `status === 'pending'`, asserts `actor.canVerify`. Does NOT call Paystack (HMAC-only strategy). Promotes pending→verified (mirror `verifyPayment` minus the Paystack call).
4. **API routes**: 3 new routes. Each follows the existing pattern: `defineEventHandler` → `requirePermission` (where applicable) → call service → `writeAudit` → return. Webhook route bypasses auth entirely.
5. **RBAC**: add `payments.paystack.init` to `parent` role in `catalog.ts`. Re-run `db:d1:seed` (idempotent upserts). Confirm via existing `/auth/me` endpoint.
6. **UI**: parent button on `billing.vue` (visible only when `actor.role === 'parent'` and invoice has outstanding balance). Use existing `formatMoney(kobo)` for display. Callback page is minimal: shows `?status=success` or "Payment is being verified" message; no DB writes.
7. **Tests** (`finance.paystack.test.ts`, `paystack.test.ts`): cover HMAC verify (valid/invalid/tampered), idempotent replay, parent-scope rejection (parent tries to pay invoice not linked to their child), already-verified no-op, unknown-reference no-op, invoice-status validation, balance check. Mock `fetch` and Paystack responses. Add to vitest suite.
8. **Env vars**: update `.env.example` with new vars (no real values). Document `wrangler secret put` flow for staging/prod (do NOT run it as part of this phase — staging stays PG).
9. **Gates**: `npm run type-check` (must exit 0), `npm run test` (vitest, must pass new + existing 413 tests), `npm run build` (EXIT 0, no wrangler in `.output`).
10. **D1 smoke**: `npm run cf:dev` (sandbox disabled, `XDG_CONFIG_HOME=/tmp/wrangler-config`) → curl `POST /api/v1/payments/paystack/initialize` with a parent auth cookie (mock Paystack `fetch` to return canned `authorization_url`) → confirm `pending` payment row exists → simulate webhook `POST /api/v1/paystack/webhook` with HMAC-signed payload → confirm payment promoted to `verified` + invoice balance updated + receipt generated. Run webhook twice → confirm idempotency.
11. **README §51**: changelog entry summarizing files, endpoints, env vars, tests, limitations (no production keys, webhook URL must be configured in Paystack dashboard for staging/prod).

## Verification (end-to-end)

| Check | How |
|---|---|
| Type safety | `cd app && npm run type-check > /tmp/tc.log 2>&1; echo $?` (must print 0) |
| Unit tests | `cd app && npm run test` (must pass new + existing 413) |
| Build | `cd app && npm run build` (must exit 0) |
| D1 migrate | `cd app && npm run db:d1:migrate` (idempotent — no schema change unless we add a column; existing schema is sufficient) |
| D1 seed | `cd app && npm run db:d1:seed` (idempotent — re-upserts parent role with new `payments.paystack.init` slug) |
| Local smoke (initialize) | Start `npm run cf:dev` → login as parent → `POST /api/v1/payments/paystack/initialize { invoiceId }` → confirm `{ authorizationUrl, reference, paymentId }` and pending row in DB |
| Local smoke (webhook) | Sign a payload with `PAYSTACK_WEBHOOK_HASH_SECRET` using HMAC-SHA512 → `POST /api/v1/paystack/webhook` with `x-paystack-signature` header → confirm payment verified, invoice balance reduced, receipt row created |
| Idempotency | Replay the same webhook payload → confirm 200 response and no second receipt / no second balance update |
| Bad signature | Tamper with payload → confirm webhook route returns 200 but payment remains pending (silent rejection) |
| Parent scope | Parent tries to initialize payment for invoice belonging to a child not in their `childIds` → 403 |
| Manual verify | Admin calls `POST /api/v1/payments/:id/paystack-verify` → pending → verified |

## Out of Scope / Deferred

- **Paystack inline-JS popup** (we use standard redirect per owner).
- **Paystack verify endpoint call** (HMAC-only per owner).
- **Production secrets** — staging stays PG, untouched. Documented for Phase 14 cutover.
- **Bank-transfer details** in `school_settings` — separate owner decision.
- **Refund via Paystack** — existing `refundPayment` marks the local row refunded; Paystack API refund integration is a separate flow (mark for Phase 11 R2 consolidation? or its own micro-phase). Phase 10 supports refund via existing route only.
- **Parent portal UI** beyond the Paystack button on billing/invoices — full Phase 9 (Parent portal) is later.
- **Staging deploy** — Phase 10 stays local-only.

## Known Limitations to Document

- Webhook URL must be configured in Paystack dashboard: `https://<worker-domain>/api/v1/paystack/webhook` (staging: `https://sms-staging.victoriouschildrenschool1.workers.dev/api/v1/paystack/webhook` — but staging remains PG until Phase 14, so webhook against staging will go to the PG-backed code which does NOT have Paystack yet). Effectively, Paystack end-to-end only works in local dev until Phase 14.
- Test keys must be obtained from Paystack dashboard (test mode) and stored in `.env` (gitignored) or via `wrangler secret put -e <env>` (never committed).
- Cloudflared tunnel needed for local webhook e2e: `cloudflared tunnel --url http://localhost:8787` → register the tunnel URL as webhook URL in Paystack test dashboard.
- `PAYSTACK_PUBLIC_KEY` is NOT used (standard redirect only).
