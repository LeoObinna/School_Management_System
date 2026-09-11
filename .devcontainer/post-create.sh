#!/usr/bin/env bash
set -euo pipefail

echo "=== SMS Devcontainer Post-Create (Nuxt + Cloudflare) ==="

# Start PostgreSQL
sudo service postgresql start || true

# Create sms database and role
sudo -u postgres psql -c "CREATE USER sms WITH PASSWORD 'sms_secret' SUPERUSER;" 2>/dev/null \
  || sudo -u postgres psql -c "ALTER USER sms WITH PASSWORD 'sms_secret' SUPERUSER;" 2>/dev/null || true
sudo -u postgres createdb -O sms sms 2>/dev/null || echo "Database 'sms' already exists."

# Install wrangler globally for Cloudflare local dev
if ! command -v wrangler &>/dev/null; then
    echo "--- Installing wrangler ---"
    npm install -g wrangler
fi

# --- Nuxt app ---
cd /workspaces/School_Management_System/app
if [ -f package.json ]; then
    echo "--- Installing app dependencies ---"
    npm install --legacy-peer-deps
    echo "--- Nuxt prepare ---"
    npx nuxt prepare
    echo "--- Type-check ---"
    npm run type-check || echo "WARNING: type-check failed"
    echo "--- Tests ---"
    npm run test || echo "WARNING: tests failed"
else
    echo "No app/package.json — skipping app setup."
fi

echo "=== Post-Create Complete ==="
echo "Database: PostgreSQL on :5432 (db=sms, user=sms)"
echo "App: cd app && npm run dev (port 3000)"
