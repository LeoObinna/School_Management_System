# Cloudflare

Cloudflare provides DNS, TLS, WAF, and object storage (R2) for this project.

## Services used

| Service         | Purpose                                      |
|-----------------|-----------------------------------------------|
| DNS             | Domain management                            |
| TLS             | HTTPS at the edge (Full strict)              |
| WAF             | Web Application Firewall rules               |
| Rate Limiting   | Edge-level rate limiting                      |
| R2              | S3-compatible object storage for files        |
| (future) Workers| Edge functions if needed                     |

## R2 — Object Storage

R2 stores all file objects: student photos, admission documents,
assignment attachments/submissions, resources, report cards, receipts,
events, gallery, exports.

### Buckets

``` text
sms-staging      # development/staging
sms-production   # production (separate credentials)
```

### Configuration

```env
R2_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<access_key>
R2_SECRET_ACCESS_KEY=<secret_key>
R2_BUCKET=sms-staging
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_USE_PATH_STYLE_ENDPOINT=true
R2_DEFAULT_REGION=auto
```

Set these as **Codespace Secrets** for dev and **GitHub repository
secrets** for CI. Never commit real R2 credentials.

### Object prefixes

``` text
students/photos/
admissions/documents/
assignments/attachments/
assignments/submissions/
resources/
report-cards/
receipts/
events/
gallery/
exports/
```

### Access patterns

- **Private objects**: served through authorized backend access or
  temporary presigned URLs. Never public.
- **Upload validation**: server-side — type, MIME, size, category,
  authorization. Generate safe object keys. Never trust client filenames.
- **Metadata**: PostgreSQL stores object metadata (key, size, type,
  uploader, timestamps). R2 stores the object bytes.

## DNS / TLS

- Cloudflare manages DNS for the school domain (supplied by project owner)
- TLS mode: **Full (strict)** — Cloudflare cert at edge, valid cert on origin
- No ports other than 443 exposed publicly
- PostgreSQL (5432) and Redis (6379) are **never** exposed publicly

## WAF

- Managed rules (Cloudflare default rule set)
- Custom rules for:
  - Block requests to `/api/*` from non-allowlisted IPs (staging only)
  - Rate limit on `/api/v1/auth/login` (e.g., 10/min per IP)
  - Block known bad bot signatures

## Caching

- Cache **public/static content only** (CSS, JS, images)
- **Never cache** authenticated API responses
- Cache TTL configured via Cloudflare page rules or Cache Rules

## What Cloudflare does NOT replace

- Application-level authorization (Policies/Gates)
- Authentication (Laravel Sanctum)
- Input validation (Form Requests)
- Database constraints

Cloudflare is the edge/security layer. Application security is in Laravel.
