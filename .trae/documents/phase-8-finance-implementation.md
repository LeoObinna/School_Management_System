# Phase 8 — Finance Implementation Plan

## Context

Phases 0–7 are complete. README §41 lists Phase 8 — Finance as the next
phase. README §19 defines the model:

```
Fee Structure -> Fee Items -> Invoice -> Invoice Items -> Payment
-> Verification -> Receipt
```

**Schema and migrations already exist** (forward-declared in the Phase 0
scaffold): all 6 finance tables live in
[app/database/schema/finance.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/finance.ts)
(`fee_structures`, `fee_items`, `student_invoices`, `invoice_items`,
`payments`, `payment_receipts`), exported from the schema barrel, and
present in `migrations/0000_clever_garia.sql`. Enums
`invoice_status` (draft/issued/partially_paid/paid/overdue/void),
`payment_status` (pending/verified/failed/refunded),
`payment_method` (cash/bank_transfer/card/online_gateway/cheque/other)
exist in [enums.ts](file:///Users/mac/Documents/School_Management_System/app/database/schema/enums.ts#L85-L109).
The 12 finance permission slugs (`fees.view/manage_structure`,
`invoices.view/create/update`, `payments.view/record/verify/refund`,
`receipts.view/generate`, `finance.export`) are already seeded with
role mappings: admin/super_admin get all; **parents get read-only**
(fees/invoices/payments/receipts `.view`); teachers and students get
none.

**No Phase 8 functionality exists yet** — no service, routes, schemas,
frontend, tests, or finance seed rows.

## Hard rules (README §19, project rules)

- Money uses NUMERIC(12,2) only. Service arithmetic is done in integer
  cents to avoid float drift; strings on the wire.
- Never hard-code fees — fee structures/items are data.
- Never trust browser payment success; payments need verification
  (manual verification in Phase 8; gateway webhooks deferred but
  `provider_reference`/`idempotency_key` columns are ready).
- Parent portal: read-only, own children only (mirror Phase 7 actor
  pattern).

## Scope decisions (user-approved)

1. **Payment gateway / webhooks — DEFERRED.** Phase 8 supports
   staff-recorded payments (cash/bank transfer/cheque/card/other) with
   an explicit verify step and refund. `online_gateway` payments can be
   recorded as `pending` and reconciled via verify; the webhook endpoint
   and provider secrets come in a later phase.
2. **Receipt PDF — DEFERRED** (consistent with Phase 7 report cards).
   Receipts are numbered metadata + JSON view; `object_key` stays null.
   Receipt is auto-created when a payment is verified.
3. **Invoice creation** supports (a) manual inline items, and
   (b) materializing items from a fee structure for one student
   (`feeStructureId` + optional `feeItemIds`, optional items excluded by
   default). No batch class-wide generation endpoint.
4. **Discounts** accepted at invoice create/issue time by staff holding
   `invoices.update` (amount, 0 ≤ discount ≤ subtotal). A multi-level
   discount approval workflow is deferred.
5. **Overdue** is computed on read (issued/partially_paid + dueDate
   passed); no cron job in Phase 8 (fee reminders are Phase 10).

## Existing patterns to mirror

Phase 7 ([app/server/services/exams.ts](file:///Users/mac/Documents/School_Management_System/app/server/services/exams.ts))
is the closest analog — Actor model with parent-ownership checks,
state-machine guards, transactional writes, `/my/school-context` for
resolving a parent's children. Phase 6 provides R2/multipart patterns
(not needed in Phase 8 since PDFs are deferred).

Reuse: `requirePermission`, `parseBody/parseInput/parseQueryData`,
`writeAudit`, `sms*` errors, `smsPaginate`, `toJsonModel/toJsonList`,
`uuidSchema/paginationQuerySchema/dateStringSchema/moneyStringSchema`,
`api/apiFetch`, `formatApiError`.

## Numbering

Within a transaction, count existing rows for the calendar year and
increment, with unique-index retry on collision:
`INV-2026-0001`, `PAY-2026-0001`, `RCT-2026-0001`.

## Files

### New — shared layer

- `app/shared/schemas/finance.ts` — zod schemas:
  feeStructure create/update (+nested fee items), feeItem upsert,
  invoiceCreate (manual items or feeStructureId materialization),
  invoiceUpdate (draft-only fields), paymentCreate, refundBody,
  list-query schemas, outstanding/summary query schemas.
- Edit `app/shared/schemas/index.ts` — barrel export.
- Edit `app/shared/types/index.ts` — FeeStructure(+Detail/Item),
  Invoice(+Detail/Item), Payment(+Detail), PaymentReceipt,
  FinanceSummary, OutstandingRow.
- `app/shared/utils/money.ts` — `toCents/fromCents/formatMoney`
  (exact 2dp; currency defaults to `NGN`, overridable).

### New — service

- `app/server/services/finance.ts`:
  - Fee structure + items CRUD (transactional item replace on update)
  - Invoice create: manual items or materialize from fee structure;
    computes subtotal/total/balance in integer cents; numbering
  - Invoice issue / void guards (draft→issued; only draft/issued
    without verified payments may be voided)
  - Payment record (`pending`, or auto-verify cash when creator also
    holds verify), verify (transactional: rejects overpayment, updates
    invoice amountPaid/balance/status to partially_paid/paid, creates
    receipt), refund (reverses amounts, sets refunded, recomputes
    invoice status)
  - Actor-scoped list/detail: parents restricted to linked children
    and issued/paid invoices (drafts hidden); parents cannot see
    pending/failed payments, only verified/refunded
  - Outstanding report (invoices with balance > 0, overdue flag,
    totals) and summary (counts by status, collected/refunded totals
    by session/term/method)
  - Audit actions: fee_structure.*, invoice.create/update/issue/void,
    payment.record/verify/refund, receipt.generate

### New — API routes (`app/server/api/v1/`)

- `fee-structures/` index.get, index.post, [id].get, [id].put,
  [id]/items.post, [id]/items/[itemId].put,
  [id]/items/[itemId].delete
- `invoices/` index.get, index.post, [id].get, [id].put,
  [id]/issue.post, [id]/void.post
- `payments/` index.get, index.post, [id].get, [id]/verify.post,
  [id]/refund.post, [id]/receipt.get
- `finance/outstanding.get.ts` (`?format=csv` requires
  `finance.export`, otherwise `invoices.view`),
  `finance/summary.get.ts`

### New — client + frontend

- `app/services/finance.ts` — typed `financeApi`.
- `app/pages/finance/fees.vue` — fee structures + items management
  (`fees.view` guard; manage buttons gated on `fees.manage_structure`).
- `app/pages/finance/invoices.vue` — staff invoicing: list/filter,
  create (manual or from structure), issue/void, detail panel with
  items, record payment, verify/refund, receipt view.
  (`invoices.view` guard).
- `app/pages/billing.vue` — parent portal: child selector (reuses
  `/my/school-context`), issued invoices + balances, verified payments
  and receipts, read-only (`invoices.view` guard; parents have it).
- Edit `app/pages/index.vue` — Finance dashboard section with links
  (staff: Fees/Invoices; parents: Billing).

### Tests

- `app/shared/__tests__/finance.test.ts` — zod coverage: money format,
  negative/over-precision rejection, item arrays required, discount
  bounds, enum values, idempotency key shape.

### Seeds

- Append Phase 8 block to `app/database/seeds/index.ts`: one fee
  structure (Primary 1, current session) with 3 fee items; one
  issued invoice for STU-001 materialized from it; one verified cash
  payment + receipt; idempotent pre-checks (invoice number / unique
  keys).

### Docs

- `docs/API.md` — "Phase 8 — Finance" endpoint tables.
- `docs/ARCHITECTURE.md` — Phases 0–8 complete, deferred items.
- `README.md` — §41 Phase 8 marked complete, §47/§51 status lines.

## Verification

```bash
npm run db:migrate
npm run db:seed
npm run test
npm run type-check
npm run build
```

Manual smoke: admin creates structure → invoice for STU-001 → issue →
record + verify payment → receipt appears; parent logs in →
/billing shows the invoice, payment and receipt only for their child.

## Known limitations

- No payment gateway/webhook (provider reference/idempotency columns
  reserved).
- Receipt/invoice PDF generation deferred; JSON views only.
- No batch invoice generation, no fee-reminder cron (Phase 10),
  no multi-level discount approval.
- Document numbers use count+1 inside a transaction (adequate scale
  for a single school; a dedicated sequence table can replace it).
