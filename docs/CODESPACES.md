# GitHub Codespaces

Development happens in GitHub Codespaces. The local Mac is a thin client.

## What is a Codespace?

A GitHub Codespace is a cloud-hosted Linux container that runs the full
dev environment. You connect to it from TRAE CN or a browser. It has:

- PHP 8.4 + Composer
- Node.js 24 + npm
- PostgreSQL 16 (service container)
- Redis 7 (service container)
- GitHub CLI (gh)
- Git (pre-installed)

## Setup

### 1. Create a Codespace

**Via browser:**
1. Go to the repository on GitHub
2. Click **Code** → **Codespaces** tab
3. Click **Create codespace on main**

**Via CLI:**
```bash
gh codespace create --repo LeoObinna/School_Management_System --branch main
```

### 2. Connect from TRAE CN

TRAE CN can connect to the Codespace via SSH or the Codespace URL. The
devcontainer auto-installs all dependencies and runs checks on creation.

### 3. Codespace Secrets

Set development secrets in GitHub Settings → Codespaces → Secrets:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

These are auto-injected as environment variables in the Codespace.

## Devcontainer structure

```
.devcontainer/
├── devcontainer.json     # VS Code extensions, port forwarding, postCreate
├── docker-compose.yml     # app + db + redis services
├── Dockerfile             # PHP 8.4 + Node 24 + Composer + gh
└── post-create.sh         # npm install, type-check, tests, composer install
```

### Ports

| Port | Service    | Notes                        |
|------|------------|------------------------------|
| 5173 | Vite       | Frontend dev server           |
| 8000 | Laravel    | API server (`php artisan serve`) |
| 5432 | PostgreSQL | Auto-forwarded (silent)      |
| 6379 | Redis      | Auto-forwarded (silent)       |

## Daily workflow

1. Open (or resume) the Codespace
2. Make changes in TRAE CN (connected to the Codespace)
3. Run checks:

```bash
# Frontend
cd /workspace/frontend
npm run dev          # start Vite (HMR)
npm run test         # Vitest
npm run type-check   # vue-tsc

# Backend (when scaffolded)
cd /workspace/backend
php artisan serve    # start API on :8000
php artisan test     # Pest/PHPUnit
php artisan tinker   # REPL
```

4. Commit and push (Codespace has Git built in)

## Cost management

- Codespaces bill per compute-minute. Stop the Codespace when not in use.
- Default machine type: 2-core (sufficient for this project)
- Auto-stop after 30 min inactivity (configurable)

### Stop / resume

```bash
gh codespace stop     # stop (preserves state)
gh codespace code     # resume in VS Code
```

## Local fallback (optional)

If you have a machine with Docker, you can run the same devcontainer
locally:

```bash
# In VS Code with Dev Containers extension
Cmd+Shift+P → "Reopen in Container"
```

This uses the same `.devcontainer/` config — identical environment.
