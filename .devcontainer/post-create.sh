#!/usr/bin/env bash
set -euo pipefail

echo "=== SMS Devcontainer Post-Create ==="

# Ensure workspace ownership
sudo chown -R vscode:vscode /workspace 2>/dev/null || true

# --- Frontend ---
cd /workspace/frontend
if [ -f package.json ]; then
    echo "--- Installing frontend dependencies ---"
    npm install
    echo "--- Frontend type-check ---"
    npm run type-check || echo "WARNING: type-check failed"
    echo "--- Frontend test ---"
    npm run test || echo "WARNING: tests failed"
else
    echo "No frontend/package.json found — skipping frontend setup."
fi

# --- Backend ---
cd /workspace
if [ -f backend/composer.json ]; then
    echo "--- Installing backend dependencies ---"
    cd /workspace/backend
    composer install --no-interaction --prefer-dist
    if [ ! -f .env ]; then
        cp .env.example .env
        php artisan key:generate --force
    fi
    echo "--- Running migrations ---"
    php artisan migrate:fresh --seed --force || echo "WARNING: migrations failed (db may not be ready)"
fi

echo "=== Post-Create Complete ==="
