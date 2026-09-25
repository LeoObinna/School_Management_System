# Phase 15 — Payments: Paystack + QR Codes Implementation Plan

> Status: awaiting owner approval. Scope = README §41 Phase 15 only.
> Phases 16 (role portals), 17 (email/SMS) and 18 (public website) remain
> deferred. Delivered in three increments (15A→15C), each independently
> green (`npm run type-check`, `npm run test`, `npm run build` from
> `app/`, cf:dev smoke, docs).

## Owner decisions (2026-09-25)

1. **Hosted redirect checkout** — server initializes the transaction,
   parent is redirected to Paystack's hosted checkout, Paystack returns
   them to our callback page. No public key, no third-party JS, no CSP
   changes.
2. **Graceful no-key mode** — when `PAYSTACK_SECRET_KEY` is absent the
   whole online-payment surface hides itself (Pay button replaced by a
   bank-transfer/QR notice). Keys are added to `app/.env` (gitignored)
   whenever ready; staging/production via `wrangler secret put`.
3. **Parents pay, partial allowed** — parents/students pay their own
   children's issued/partially-paid invoices online, any amount up to
   the balance (mirrors the manual recording rules).

## Repository Research

- `payments` schema already anticipates the gateway: `providerReference`,
  unique `idempotencyKey`, `webhookPayload`, and `paymentMethodEnum`
  includes `online_gateway`. Receipts carry `objectKey` for an R2 PDF.
  **No migration needed in Phase 15.**
- `verifyPayment()` in `app/server/services/finance.ts` already performs
  the verified-payment accounting atomically (payment → invoice
  amountPaid/balance/status → receipt row). The webhook/callback path
  reuses the same batch logic via a shared internal helper.
- Auth middleware (`server/middleware/00.auth.ts`) only enforces CSRF
  when a session cookie is present — the unauthenticated Paystack
  webhook passes untouched; its own HMAC signature check is the guard.
- Secrets pattern: `nuxt.config.ts` runtimeConfig ships EMPTY defaults
  (they get compiled into the Worker bundle); real values are injected
  per request by `server/plugins/cloudflare.ts` from Cloudflare bindings
  or `process.env` in dev. `PAYSTACK_SECRET_KEY` follows this pattern;
  `.env.example` documents it with a placeholder.
- Settings already hold `bankName`/`accountName`/`accountNumber`
  (admin-only fields) — source for receipts and the office QR.
- pdf-lib is installed and proven on Workers (`server/utils/pdf/
  report-card.ts` pattern: pure renderer → bytes; route stores in R2).
- QR: add the `qrcode` package (pure-JS renderers; SVG string for the
  browser, PNG via pngjs for pdf-lib embedding). `@types/qrcode` for
  dev. No canvas APIs.
- Parents already hold `invoices.view`, `payments.view`,
  `receipts.view`; online payment reuses those — **no new permissions,
  no re-seed**.
- Callback/cancel URLs derive from the request origin so no domain is
  hard-coded (real domain is an owner decision, Phase 19).
- Paystack API = plain `fetch` from the Worker
  (`api.paystack.co/transaction/initialize`, `/transaction/verify/:ref`),
  secret key in the Authorization header, never logged.

## Files and Modules

### Server
- `server/utils/paystack/client.ts` — typed `initializeTransaction()`
  and `verifyTransaction()` over fetch; raises structured errors; reads
  config via `getPaystackConfig(event)`.
- `server/utils/paystack/signature.ts` — pure HMAC-SHA512 hex of the raw
  body (Web Crypto), timing-safe compare. Unit-testable without Workers.
- `server/utils/paystack/reference.ts` — reference format
  `VCS-{invoiceNumber}-{uuid8}`; parsing helpers.
- `server/services/paystack.ts` — orchestration:
  - `initializeOnlinePayment(invoiceId, amount, actor)` — validates the
    invoice is payable by this actor (parent-of-student or staff),
    amount ≤ balance, creates the pending payment
    (`method: online_gateway`, our `PAY-YYYY-NNNN` reference,
    `providerReference` = Paystack reference, `idempotencyKey` =
    `paystack:{reference}`), calls initialize, stores nothing sensitive,
    returns `{ authorizationUrl, reference }`.
  - `verifyOnlinePayment(reference, actor | null)` — server-side
    Paystack verify; on confirmed success + amount/currency match runs
    the verification batch (payment → verified, invoice totals, receipt
    row) exactly once; already-verified returns the payment unchanged
    (idempotent). Mismatch (amount/currency/status) → conflict error,
    payment stays pending with notes.
  - `handlePaystackWebhook(rawBody, signature)` — signature check,
    `charge.success` only, delegates to the same idempotent verification
    path; stores `webhookPayload` JSON and Paystack transaction id on
    the payment; always 200 on known/duplicate events, 401 on bad
    signature.
- Routes:
  - `POST /api/v1/payments/paystack/initialize` — auth + `payments.view`,
    parent-scoped.
  - `POST /api/v1/payments/paystack/webhook` — unauthenticated,
    signature-verified (raw body read before parsing).
  - `POST /api/v1/payments/paystack/verify` — auth; the callback page
    calls it with `{ reference }`; browser redirect alone never verifies.
  - `GET /api/v1/payments/{id}/receipt/download` — `receipts.view`,
    parent-scoped; generates the branded PDF lazily (pdf-lib), stores
    bytes in R2 at `receipts/{receiptNumber}.pdf`, persists `objectKey`,
    streams with `Content-Type: application/pdf`.
  - `GET /api/v1/invoices/{id}/qr.svg` — per-invoice dynamic QR
    (bank details + invoice number as transfer reference + amount due),
    parent/staff scoped.
  - `GET /api/v1/finance/office-qr.svg` — static office QR encoding the
    settings bank details; any authenticated user with `payments.view`.
- `server/utils/pdf/receipt.ts` — pure branded receipt renderer (school
  name/motto/colors from settings, receipt + payment references, item
  list, totals in ₦ from kobo, bank details block, embedded QR PNG with
  payment reference for authenticity).
- `server/plugins/cloudflare.ts` + `nuxt.config.ts` — add empty-default
  `paystackSecretKey` runtimeConfig key with per-request injection.
- `app/.env.example` — document `PAYSTACK_SECRET_KEY` (placeholder) and
  the dashboard webhook URL ops step.

### Client
- `services/finance.ts` — `initializePaystack`, `verifyPaystack`,
  receipt download + QR URL helpers.
- `pages/billing.vue` — per-invoice item breakdown ("fee purposes" —
  tuition, sports, etc. are fee-item data, nothing hard-coded), Pay
  Online button (amount field ≤ balance) visible only when the server
  reports Paystack configured, bank-details card + office QR fallback
  otherwise, receipt download buttons on verified payments, dynamic QR
  on the invoice detail.
- `pages/payments/callback.vue` — reads `?reference`, calls the verify
  endpoint, shows success/pending/failed, links back to billing.
- `pages/finance/invoices.vue` (staff) — receipt download link on
  verified payments (staff side of the same route).

### Shared
- `shared/schemas/payments.ts` (extend) — `paystackInitializeSchema`
  (`invoiceId`, positive kobo `amount`), `paystackVerifySchema`
  (`reference`).
- `shared/types/index.ts` — `PaystackInitializeResult`,
  `OnlinePaymentStatus`, extend `PaymentDetail` with `providerReference`
  surfaced to staff.

## Implementation Steps

### Increment 15A — Paystack end-to-end
1. runtimeConfig plumbing + `.env.example` + `isPaystackConfigured()`
   surfaced via an existing config endpoint (e.g. extend
   `/my/school-settings` response or finance summary — pick the lightest).
2. Paystack client, signature, and reference utils (+ unit tests:
   signature vectors, reference parse, error mapping).
3. `paystack.ts` service + the three routes; idempotency on both the
   callback-verify and webhook paths; audit entries
   (`payment.initialize`, existing `payment.verify`, webhook events
   logged without secrets).
4. Callback page + billing-page Pay Online flow with purposes breakdown;
   graceful no-key/bank-transfer fallback.
5. Tests: initialize validation (scope, amount, invoice status),
   verify idempotency, webhook signature accept/reject, duplicate
   webhook no-op, amount-mismatch guard. Gates + cf:dev smoke
   (no-key mode, then with test keys if available).

### Increment 15B — Branded PDF receipts
6. `receipt.ts` renderer (settings-branded; bank block only when
   populated) + lazy generate/store/stream download route; staff and
   parent scoping via existing `getPaymentReceipt` rules.
7. Billing + staff invoices pages: receipt download buttons.
8. Tests: renderer produces `%PDF` bytes with expected content, lazy
   generation persists `objectKey`, scope enforcement. Gates + smoke.

### Increment 15C — QR codes + polish
9. Add `qrcode` (+ types); QR payload builders (office = settings bank
   details; invoice = bank + invoice number + amount; receipt =
   payment/receipt reference embedded in the PDF).
10. Office QR + bank card on the billing page; per-invoice QR in invoice
    detail; receipt PDF embeds its QR.
11. Tests: payload builders, SVG/PNG output shapes, route auth. Gates +
    full cf:dev smoke; docs sweep.

## Documentation (each increment)
- `docs/API.md` — Phase 15 section (endpoints, webhook contract,
  idempotency rules).
- README — §41 Phase 15 status, §46/§47 current-phase lines, §51 dated
  changelog entry.
- `docs/SECURITY.md` — webhook signature + never-trust-browser note.
- `docs/DEPLOYMENT.md` — `wrangler secret put PAYSTACK_SECRET_KEY` and
  Paystack dashboard webhook URL ops steps (no real domain invented).

## Validation (per increment and final)
- `npm run type-check`, `npm run test`, `npm run build` exit 0.
- cf:dev smoke: parent sees purposes + Pay button only with keys;
  initialize → Paystack test checkout → callback → verified payment,
  receipt row + PDF download; duplicate webhook is a no-op; bad
  signature → 401; staff manual flow (record/verify/refund) untouched.
- Privacy: bank details only to authenticated users with payments
  permission; no secrets in logs or client bundle.

## Risks
- **No live keys during dev** — mitigated by graceful no-key mode +
  contract tests; final real-transaction smoke needs the owner's test
  keys.
- **Webhook replay** — unique `idempotencyKey` + status guard +
  signature verification; duplicates return 200 without side effects.
- **Amount tampering** — server re-verifies amount/currency/status from
  Paystack before any accounting; browser callback never mutates state.
- **qrcode PNG in Workers** — pngjs renderer is pure JS; verified at
  build/test time in 15C before wiring the PDF embed (fallback: draw
  QR modules as vector rects directly in pdf-lib).
- **Refunds** — stay manual (staff record refund; the actual bank
  reversal is an offline/Paystack-dashboard action). Out of scope.
