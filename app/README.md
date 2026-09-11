# SMS App — Nuxt 4 + Cloudflare Workers + PostgreSQL

The School Management System application. Built with Nuxt 4 (Vue 3 +
Nitro), TypeScript, Drizzle ORM, and PostgreSQL. Deployed to Cloudflare
Workers with R2 object storage and Hyperdrive for database pooling.

## Stack

| Concern         | Technology                          |
|-----------------|-------------------------------------|
| Framework       | Nuxt 4 (Vue 3 + Nitro)              |
| Language        | TypeScript (strict)                 |
| Styling         | Tailwind CSS v4                     |
| State           | Pinia                               |
| ORM             | Drizzle ORM (PostgreSQL)            |
| Validation      | zod (shared schemas)                |
| Deploy target   | Cloudflare Pages (Workers runtime)  |
| Object storage  | Cloudflare R2                       |
| Background jobs | Cloudflare Queues                   |
| Database pool   | Cloudflare Hyperdrive               |
| Testing         | Vitest + @vue/test-utils            |

## Quick start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Generate Nuxt types
npx nuxt prepare

# Run dev server (http://localhost:3000)
npm run dev

# Type-check
npm run type-check

# Tests
npm run test

# Build for Cloudflare Pages
npm run build

# Preview the Cloudflare Pages build locally
npx wrangler pages dev dist
```

## Environment

Copy `.env.example` to `.env` and set:

| Variable          | Purpose                                |
|-------------------|----------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string           |
| `SESSION_SECRET`  | Secret for signing session cookies     |
| `R2_*`            | Cloudflare R2 credentials (dev only)   |

In Codespaces, use Codespace Secrets for sensitive values.

## Database

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (dev only)
npm run db:push
```

## Project structure

```text
app/
├── app.vue              # Root component
├── components/          # Vue components (auto-imported)
├── assets/css/          # Tailwind entry + theme
├── plugins/             # Nuxt plugins (e.g., Pinia)
├── pages/               # File-based routing (added in later phases)
├── stores/              # Pinia stores
├── server/
│   ├── api/v1/          # Nitro server routes (/api/v1/*)
│   ├── middleware/      # Auth / RBAC middleware
│   └── utils/           # DB connection, helpers
├── shared/
│   ├── types/           # Shared TS types (client + server)
│   └── schemas/         # Shared zod validation schemas
├── database/
│   ├── schema/          # Drizzle schema definitions
│   └── migrations/      # Generated SQL migrations
├── public/              # Static assets
└── ...
```

## Architecture decision

See `../ARCHITECTURE_DECISION_RECORD.md` and `../MIGRATION_PLAN.md`
for the rationale behind the Nuxt + Cloudflare migration.
