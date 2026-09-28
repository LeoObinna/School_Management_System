# Cloudflare

The entire application (Nuxt SSR + Nitro API + static assets) runs on
**Cloudflare Workers** via the Nitro `cloudflare-module` preset.
Deployments are manual Wrangler commands from the local machine; there
is no Git integration or CI deployment.

## Services used

| Service         | Purpose                                          |
|-----------------|--------------------------------------------------|
| Workers + Static Assets | Application runtime (`sms-staging`, `sms-production`) |
| R2              | Private object storage via the R2_BUCKET binding |
| Queues/Cron     | Background jobs/schedules (from Phase 10)        |
| DNS / TLS / WAF / Rate Limiting | Edge security                          |
| Workers secrets | `SESSION_SECRET` and other environment secrets   |

## Configuration

`app/wrangler.toml` declares the Worker entry (`.output/server/index.mjs`),
the `[assets]` ASSETS binding, and named environments `staging` and
`production`, each with its own D1 database and R2 bucket. The retired
Pages config is preserved in `app/wrangler.pages.toml` (not loaded).

Bindings reach the application per request on
`event.context.cloudflare.env`; no Cloudflare API tokens are used by the
Worker.

``` text
npm run cf:dev             # local Workers emulation (R2 on local disk)
npm run deploy:staging     # wrangler deploy -e staging
npm run deploy:production  # wrangler deploy -e production
```

## R2 — Object Storage

R2 stores file objects (Phase 6 implements assignment
attachments/submissions and teaching resources; other categories below
are planned).

### Buckets (isolated per environment)

``` text
sms-staging      # staging
sms-production   # production
```

### Access — binding only

The Worker accesses R2 exclusively through the `R2_BUCKET` binding
(`server/utils/storage.ts`). S3-compatible key/secret credentials are
**not** used by the application and must not be placed in `.env` or
committed. (Create S3 API tokens only for external backups if ever
needed; keep them outside the repository.)

### Object prefixes

``` text
assignments/attachments/
assignments/submissions/
resources/
lesson-notes/                (Phase 16: lesson-note attachments,
                             25 MB cap, magic-byte-validated uploads)
students/photos/            (planned)
admissions/documents/       (planned)
report-cards/ receipts/     (planned)
```

### Access patterns

- **Private objects only**: bytes are streamed through authorized
  `/api/v1` endpoints after RBAC checks; responses set
  `Cache-Control: private, no-store`. The public `r2.dev` URL must stay
  disabled.
- **Upload validation**: server-side — type, MIME, size, authorization;
  safe generated keys (`buildObjectKey`); never trust client filenames.
- **Metadata**: D1 stores object metadata; R2 stores bytes.

## Secrets

Set per environment with Wrangler; secrets never go in Git or
`wrangler.toml`:

``` text
wrangler secret put SESSION_SECRET -e production
wrangler secret put PAYSTACK_SECRET_KEY -e production
wrangler secret put RESEND_API_KEY -e production
wrangler secret put SEND_FROM_EMAIL -e production
wrangler secret put TERMII_API_KEY -e production
wrangler secret put TERMII_SENDER_ID -e production
```

`PAYSTACK_SECRET_KEY` (Phase 15 online payments) is optional: without it
the app runs in no-key mode and the online-checkout UI hides itself.
After setting it, register the webhook in the Paystack dashboard
(Settings → Webhooks) pointing at
`https://<your-domain>/api/v1/payments/paystack/webhook` — the dashboard
secret key and the Worker secret must be the same value.

Phase 17 email/SMS secrets (Resend + Termii) are optional: without
`RESEND_API_KEY` the email channel is silently skipped (delivery rows
recorded as failed); without `TERMII_API_KEY` the SMS channel is
silently skipped. In-app notifications still work. `SEND_FROM_EMAIL`
must be a verified sender in the Resend dashboard.

Local development secrets live only in the gitignored `app/.dev.vars`
(Nitro runtime) and `app/.env` (build-time). `SESSION_SECRET` must
stay stable across deploys or users are logged out.
`EXPOSE_RESET_TOKENS=true` is allowed in local dev only.

## Cron triggers (Phase 13 + 17)

`nuxt.config.ts` `scheduledTasks`:
``` text
*/5 * * * *  publish-scheduled-announcements, send-fee-reminders
```

- `publish-scheduled-announcements`: publishes announcements with
  `status='scheduled'` whose `scheduled_for` is due (Phase 13).
- `send-fee-reminders`: queries overdue invoices and sends one
  consolidated reminder per parent (in-app + email + SMS). Self-gates
  to once per UTC day via EDGE_KV key `cron:fee-reminders:YYYY-MM-DD`.

Local testing: `npx wrangler dev --test-scheduled` then
`POST /__scheduled?cron=*/5+*+*+*+*` to fire the scheduled handler.

## Queues (Phase 12 + 17)

`NOTIFICATION_QUEUE` binding (producer + consumer). The consumer
plugin (`server/plugins/cloudflare-queue.ts`) dispatches via a zod
discriminated union on `message.body`. Phase 17 added `result.published`,
`payment.verified`, `email.send`, and `sms.send` message kinds to the
existing `announcement.published`. Malformed messages are acked as
poison; transient DB failures trigger `message.retry()`.

## DNS / TLS / WAF

- TLS mode: **Full (strict)**; only 443 exposed publicly
- WAF managed rules + rate limiting on `/api/v1/auth/login`
- Cache public static assets only; never cache authenticated responses

## What Cloudflare does NOT replace

Application authorization (RBAC), session/authentication logic, zod input
validation, and D1 constraints all remain enforced server-side
in the Worker. Cloudflare is the runtime and edge-security layer.
