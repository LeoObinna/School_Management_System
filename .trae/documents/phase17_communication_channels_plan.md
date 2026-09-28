# Phase 17 — Communication Channels (Email / SMS / Notifications)

Owner-approved forward roadmap item (README §47, 2026-09-20). Builds on the
existing queue infrastructure (Phase 12 Part B: `NOTIFICATION_QUEUE`, queue
consumer, `notification-dispatch.ts`, `notifications` table, cron triggers)
which currently creates in-app notification rows only — no external delivery.

Standing rules: zod validation, server-side authorization, Vitest, gates after
each increment (`npm run type-check`, `npm run test`, `npm run build` from
`app/`), cf:dev smoke, docs sweep, manual Wrangler deploys only, no commits
unless asked, no invented business rules.

## Existing building blocks (verified)

| Need | Already exists |
|---|---|
| Queue producer/consumer | `NOTIFICATION_QUEUE` binding in `wrangler.toml`; `server/plugins/cloudflare-queue.ts` ack/retry/poison handling; `server/utils/notifications-queue.ts` producer; `server/services/notification-dispatch.ts` message router + `announcement.published` fan-out |
| In-app notifications | `notifications` table (D1): `user_id`, `type`, `title`, `body`, `link`, `status`, `announcement_id`; partial unique index for idempotent fan-out; `GET /api/v1/notifications` |
| Cron triggers | Every 5 min via `wrangler.toml` + Nitro scheduled task `publish-scheduled-announcements.ts` |
| Email addresses | `users.email`, `parents.email`, `teachers.email`, `staff_profiles.email` — all nullable text |
| Phone numbers | `parents.phone`, `teachers.phone`, `staff_profiles.phone` — all nullable text |
| Result publication | `POST /api/v1/exam-results/:id/publish` (admin, `exam_results.publish`) marks `result_publications.status = 'published'`; students/parents then see scores |
| Fee/invoicing | `student_invoices` table with `status`, `balance`, `due_date`; `student_parents` links parents to students |
| Missing | External email provider, SMS gateway, notification-preferences table, newsletter subscription table, event-driven notification triggers (fee reminders, result published) |

## Owner decisions needed

1. **Email provider:** Resend (free tier, 100 emails/day, simple REST API,
   no SMTP) is the recommended default for a Nigerian school with modest volume.
   Alternative: SendGrid, AWS SES. **→ Resend unless you say otherwise.**
2. **SMS gateway:** Termii (Nigerian, REST API, supports bulk, delivery
   reports) is the recommended default. **→ Termii unless you say otherwise.**
3. **Fee reminder cadence:** daily at 08:00? weekly? only for invoices past
   due by N days? **→ Default: daily cron at 08:00, only invoices ≥1 day
   overdue, one reminder per invoice (tracked via `notifications` row or
   dedicated `notification_deliveries` table).**
4. **Result-published notification:** notify all parents of students in the
   class whose results were published? Or only parents with published children?
   **→ Default: parent of every student in the published class/session/term.**
5. **Newsletter scope:** public (any email can subscribe) or restricted to
   users with portal accounts? **→ Default: public subscription form on the
   public website (deferred to Phase 18), but the storage table + admin
   list/export is built now.**

## Increments

### 17A — Email provider integration (Resend)

Schema migration **0004**: `notification_deliveries` table to track every
external delivery attempt (email or SMS) with idempotency: `id`,
`notification_id` → `notifications.id` (nullable for standalone sends),
`channel` (`email` | `sms`), `recipient_address`, `provider` (`resend` |
`termii`), `provider_message_id`, `status` (`pending` | `sent` | `bounced` |
`failed`), `sent_at`, `error_message`, `created_at`. Indexes on
`notification_id + channel` and `recipient_address + created_at`.

Server utilities:
- `server/utils/email/resend-client.ts` — typed fetch wrapper around Resend
  `POST /emails/send` (from address, to[], subject, html/text, reply-to).
  Handles 4xx/5xx, retries once on 502/503, never logs the API key or body.
  Returns `{ id: providerMessageId } | { error }`.
- `server/utils/email/templates.ts` — pure template functions returning
  `{ subject: string; html: string; text: string }`:
  - `announcementEmail(announcement)` — school-branded HTML with the
    announcement title/body and a CTA link back to the portal.
  - `feeReminderEmail(parentName, studentName, invoiceDetails)` — list of
    overdue invoices with balances and due dates.
  - `resultPublishedEmail(parentName, studentName, className, termName)` —
    notification that results are now available with a link to the portal.

Queue contract expansion:
- Add `email.send` message kind to `notification-dispatch.ts`:
  `{ kind: 'email.send', to: string, subject: string, html: string, text: string,
  notificationId?: string }`.
- `dispatchMessage` routes `email.send` to a new `dispatchEmailSend(client,
  message)` that calls the Resend client, inserts a `notification_deliveries`
  row, and on failure records the error (no retry loop — the queue's own
  redelivery handles transient failures).

Announcement publish integration:
- Extend `dispatchAnnouncement` in `notification-dispatch.ts`: after creating
  in-app notification rows, for each recipient who has `email` on their
  `users` row and has not opted out of announcement emails (checked against
  the preferences table from 17B), enqueue one `email.send` message.
  **→ Actually, to avoid N queue messages for N recipients, batch by
  Resend's limit (50 recipients per call) or fan out individually. Decision:
  individual `email.send` messages for audit granularity, or batched BCC for
  efficiency. Default: individual messages via the queue (the queue handles
  concurrency).**

Environment: `RESEND_API_KEY` via `wrangler secret put` (production) and
`app/.env` (local). `SEND_FROM_EMAIL` (e.g. `noreply@victoriouschildren.school`)
via `wrangler secret put` or runtime config.

Gates: type-check, test (Resend client mock, template rendering, dispatch
routing), build, cf:dev smoke (send a test email via queue with a fake key →
expected 401/403 from Resend, delivery row recorded as failed).

### 17B — Notification preferences + newsletter subscriptions

Schema migration **0004** (same migration as 17A if not yet applied): adds
`user_notification_preferences` table: `user_id` PK → `users.id`,
`announcement_email` boolean default true, `fee_reminder_email` boolean default
true, `result_published_email` boolean default true, `urgent_sms` boolean
default true, `digest_email` boolean default false, `updated_at`.

Also `newsletter_subscriptions` table: `id` PK, `email` unique not null,
`name` nullable, `status` (`subscribed` | `unsubscribed`) default
`subscribed`, `subscribed_at`, `unsubscribed_at`, `created_at`.

APIs:
- `GET /api/v1/me/notification-preferences` — own preferences (any auth).
- `PATCH /api/v1/me/notification-preferences` — update own preferences,
  partial, at least one field. Audited.
- `POST /api/v1/newsletter/subscribe` — **unauthenticated** (public); body
  `{ email, name? }`. Idempotent: existing subscribed email returns 200
  unchanged; unsubscribed email re-subscribes. Rate-limited (5/min per IP).
- `POST /api/v1/newsletter/unsubscribe` — **unauthenticated**; body
  `{ email }` or token-based (token = HMAC of email + secret). Sets status
  `unsubscribed`.
- `GET /api/v1/admin/newsletter-subscriptions` — `newsletter.view`
  (new permission); queryable list with filters (status, date range), CSV
  export via existing export util.

Seed: add `newsletter.view` and `newsletter.manage` to the canonical permission
list; admin + super_admin get them.

Gates: type-check, test (preference CRUD, subscription idempotency,
unsubscribe token, rate limit, admin list), build, cf:dev smoke.

### 17C — Event-driven notifications (fee reminders + result published)

**Fee reminders:**
New Nitro scheduled task `send-fee-reminders.ts` running daily at 08:00 via
`wrangler.toml` cron trigger (or reuse the existing 5-min cron and gate on
hour). The task:
1. Queries `student_invoices` where `status IN ('issued', 'partially_paid')`
   AND `due_date < today` AND `balance > 0`.
2. For each parent linked to the student via `student_parents`, check
   `user_notification_preferences.fee_reminder_email`.
3. Enqueue one `email.send` per parent with a consolidated fee-reminder
   template (all their children's overdue invoices in one email).
4. Also create an in-app notification row (`type: 'fee_reminder'`) so the
   parent sees it in the portal.
5. Track in `notification_deliveries`.

**Result published:**
Extend `POST /api/v1/exam-results/:id/publish` route: after marking the
publication as published (existing logic), query all students in the class,
then all parents of those students via `student_parents`. For each parent
with `result_published_email = true`, enqueue `email.send` with the
result-published template, and create an in-app notification row
(`type: 'result_published'`).

Gates: type-check, test (reminder query logic, result-publish notification
routing, preference opt-out respected), build, cf:dev smoke (simulate
overdue invoice → queue message produced → mock delivery row created).

### 17D — SMS gateway (Termii) + scheduled digest

Server utilities:
- `server/utils/sms/termii-client.ts` — typed fetch wrapper around Termii
  `POST /api/sms/send` (API key, to, from, sms, type). Handles 4xx/5xx,
  retries once on 502/503, never logs the API key. Returns delivery tracking.
- `server/utils/sms/templates.ts` — short SMS templates (≤160 chars):
  - `urgentNoticeSms(title)` — truncated announcement title.
  - `feeReminderSms(studentName, balance, dueDate)` — "Fee reminder for
    [Name]: ₦X,XXX.00 due [date]. Pay online: [link]"
  - `resultPublishedSms(studentName, termName)` — "Results for [Name] -
    [Term] are now published. View: [link]"

Queue contract: add `sms.send` message kind:
`{ kind: 'sms.send', to: string, text: string, notificationId?: string }`.
`dispatchMessage` routes to `dispatchSmsSend` which calls Termii, inserts
`notification_deliveries` row.

Integration points:
- Announcement publish: for audience `all`/`parents`/`teachers`, also send SMS
  to recipients with `urgent_sms = true` (checked via preferences) and a
  `phone` number on their linked profile (parents.phone, teachers.phone).
- Fee reminders: also SMS parents with `urgent_sms = true`.
- Result published: also SMS parents with `urgent_sms = true`.

Environment: `TERMII_API_KEY` and `TERMII_SENDER_ID` via `wrangler secret
put` / `app/.env`.

**Scheduled digest (Cron Trigger):**
New Nitro scheduled task `send-daily-digest.ts` running daily at 07:00.
For every user with `digest_email = true`, compile a summary of unread
in-app notifications from the last 24 hours and enqueue one `email.send`
with a digest template. If no unread notifications, skip.

Gates: type-check, test (Termii client mock, SMS template length, digest
query, dispatch routing), build, cf:dev smoke.

## Known limitations / out of scope

- **No email template engine** (MJML, Handlebars) — pure string templates are
  sufficient for the three template types.
- **No email tracking** (open rates, click tracking) — out of scope.
- **No SMS two-way** (reply handling) — out of scope.
- **No push notifications** — out of scope (Phase 19+).
- **Public website newsletter form** — deferred to Phase 18; the API
  endpoints are built now and can be called from the public site later.
- **Rich HTML email design** — minimal branded HTML (school name, logo URL
  from settings); no complex layouts.

## Docs sweep checklist

- [ ] README §41 Phase 17 heading → `✅ COMPLETE`
- [ ] README §46 current status block
- [ ] README §47 migration status paragraph
- [ ] README §51 changelog entry
- [ ] docs/API.md Phase 17 section
- [ ] docs/SECURITY.md: email/SMS provider secrets, unsubscribe tokens,
  rate limiting on public endpoints
- [ ] docs/CLOUDFLARE.md: new cron tasks, Resend/Termii secret names
- [ ] `.env.example`: `RESEND_API_KEY`, `SEND_FROM_EMAIL`, `TERMII_API_KEY`,
  `TERMII_SENDER_ID`

## Final report items

- Files created/modified, migration numbers, new endpoints, tests added,
  known limitations. No commits; no production deploy.
