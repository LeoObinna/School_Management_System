# Cloudflare

The entire application (Nuxt SSR + Nitro API + static assets) runs on
**Cloudflare Workers** via the Nitro `cloudflare-module` preset.
Deployments are manual Wrangler commands from the local machine; there
is no Git integration or CI deployment.

## Services used

| Service         | Purpose                                          |
|-----------------|--------------------------------------------------|
| Workers + Static Assets | Application runtime (`sms-staging`, `sms-production`) |
| Hyperdrive      | PostgreSQL connection pooling from Workers       |
| R2              | Private object storage via the R2_BUCKET binding |
| Queues/Cron     | Background jobs/schedules (from Phase 10)        |
| DNS / TLS / WAF / Rate Limiting | Edge security                          |
| Workers secrets | `SESSION_SECRET` and other environment secrets   |

## Configuration

`app/wrangler.toml` declares the Worker entry (`.output/server/index.mjs`),
the `[assets]` ASSETS binding, and named environments `staging` and
`production`, each with its own Hyperdrive id and R2 bucket. The retired
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
- **Metadata**: PostgreSQL stores object metadata; R2 stores bytes.

## Hyperdrive

``` text
sms-pg-staging     -> staging managed PostgreSQL
sms-pg-production  -> production managed PostgreSQL
```

Workers open one connection per isolate (`max: 1`); Hyperdrive handles
pooling. Migrations are never run through Hyperdrive — use the direct
database URL.

## Secrets

Set per environment with Wrangler; secrets never go in Git or
`wrangler.toml`:

``` text
wrangler secret put SESSION_SECRET -e staging
wrangler secret put SESSION_SECRET -e production
```

Local development secrets live only in the gitignored `app/.env`.
`SESSION_SECRET` must stay stable across deploys or users are logged
out. `EXPOSE_RESET_TOKENS=true` is allowed in local dev only.

## DNS / TLS / WAF

- TLS mode: **Full (strict)**; only 443 exposed publicly
- PostgreSQL is never publicly exposed beyond the managed provider's TLS
  endpoint consumed by Hyperdrive
- WAF managed rules + rate limiting on `/api/v1/auth/login`
- Cache public static assets only; never cache authenticated responses

## What Cloudflare does NOT replace

Application authorization (RBAC), session/authentication logic, zod input
validation, and PostgreSQL constraints all remain enforced server-side
in the Worker. Cloudflare is the runtime and edge-security layer.
