#!/usr/bin/env bash
set -euo pipefail

echo "=== SMS Devcontainer Post-Create ==="

# Start services
sudo service postgresql start || true
sudo service redis-server start || true

# Create sms database and role
sudo -u postgres psql -c "CREATE USER sms WITH PASSWORD 'sms_secret' SUPERUSER;" 2>/dev/null \
  || sudo -u postgres psql -c "ALTER USER sms WITH PASSWORD 'sms_secret' SUPERUSER;" 2>/dev/null || true
sudo -u postgres createdb -O sms sms 2>/dev/null || echo "Database 'sms' already exists."

# Install Composer
if ! command -v composer &>/dev/null; then
    echo "--- Installing Composer ---"
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# --- Frontend ---
cd /workspaces/School_Management_System/frontend
if [ -f package.json ]; then
    echo "--- Installing frontend dependencies ---"
    npm install
    echo "--- Frontend type-check ---"
    npm run type-check || echo "WARNING: type-check failed"
    echo "--- Frontend test ---"
    npm run test || echo "WARNING: tests failed"
else
    echo "No frontend/package.json — skipping frontend setup."
fi

# --- Backend ---
cd /workspaces/School_Management_System
if [ -d backend ] && [ -f backend/composer.json ]; then
    echo "--- Installing backend dependencies ---"
    cd /workspaces/School_Management_System/backend
    composer install --no-interaction --prefer-dist
    if [ ! -f .env ]; then
        cp .env.example .env
        php artisan key:generate --force
    fi
    php artisan migrate:fresh --seed --force || echo "WARNING: migrations failed"
fi

echo "=== Post-Create Complete ==="
echo "Services: PostgreSQL on :5432, Redis on :6379"
echo "Frontend: cd frontend && npm run dev (port 5173)"
echo "Backend:  cd backend && php artisan serve (port 8000) [when scaffolded]"

