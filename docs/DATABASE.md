# Database Strategy

## PostgreSQL 16

PostgreSQL is the **source of truth** for all relational data.

## Development (Codespace)

The devcontainer runs PostgreSQL 16 (Alpine) as a service container:

``` text
Host:     db          (docker-compose service name)
Port:     5432
Database: sms
User:     sms
Password: sms_secret   (dev only — never use in staging/production)
```

Connection is pre-configured in `.env.example`. The Codespace forwards
port 5432 so you can connect from the VS Code PostgreSQL explorer.

## Staging / Production

Use a managed PostgreSQL service (e.g., Cloudflare D1 Hyperdrive backend,
Neon, Supabase, or a managed RDS/CloudSQL instance). Configure via
environment variables:

``` text
DB_HOST=<managed-host>
DB_PORT=5432
DB_DATABASE=sms_staging   # or sms_production
DB_USERNAME=<managed-user>
DB_PASSWORD=<managed-password>
```

Set these as **Codespace Secrets** (for dev) or **GitHub repository
secrets** (for CI) — never commit real credentials.

## Schema principles

- Foreign keys on all relationships
- Meaningful unique constraints (e.g., student+session+term for enrollments)
- Index real query paths, not every column
- `NUMERIC` / `DECIMAL` for money — never floating point
- Timestamps (`created_at`, `updated_at`) on all tables
- `deleted_at` for soft-delete only where domain-appropriate
- Migrations are version-controlled and reversible

## Migration order

Follow the dependency-aware sequence in README §40. Never run migrations
out of order without a documented dependency reason.

## Backup strategy

- **Dev**: `pg_dump` manually or via post-create script
- **Staging**: Daily automated snapshot (managed service)
- **Production**: Point-in-time recovery + daily snapshot + tested restore

## Testing database

CI uses a separate `sms_testing` database. Migrations run fresh on every
CI run. See [TESTING.md](./TESTING.md).
