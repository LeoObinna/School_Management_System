# Testing

## Overview

| Layer      | Tool        | Scope                                      |
|------------|-------------|---------------------------------------------|
| Frontend   | Vitest 5    | Components, stores, services, forms         |
| Backend    | Pest/PHPUnit| Feature + unit, authorization boundaries    |
| E2E        | Playwright  | Login, student CRUD, parent linking, etc.   |
| Type-check | vue-tsc     | TypeScript strict mode                      |
| Build      | Vite        | Production build                            |

## Frontend tests

```bash
cd frontend
npm run test          # one-shot run
npm run test:watch    # watch mode
npm run type-check    # vue-tsc --build
npm run build         # type-check + production build
```

Current coverage: 6 tests (BaseButton component, health store). All passing.

Test files:
- `frontend/src/components/ui/__tests__/BaseButton.test.ts`
- `frontend/src/stores/__tests__/health.test.ts`

## Backend tests (when scaffolded)

```bash
cd backend
php artisan test                    # Pest or PHPUnit
php artisan test --coverage         # with coverage
vendor/bin/pest                     # direct Pest
```

Must cover:
- Authentication (login, logout, password reset)
- Authorization (role/permission boundaries per README §8)
- Parent-child isolation (parent can only access own children)
- Teacher scope (only assigned classes/subjects)
- Student isolation (no cross-student access)
- Attendance uniqueness (no duplicate records)
- Timetable conflict detection
- Result workflow (Draft → Submitted → Approved → Published)
- Grade calculation accuracy
- Finance (invoice → payment → receipt, money precision)
- Admissions workflow
- File access authorization (R2 presigned URLs)
- Audit logging of sensitive operations

## CI pipeline

`.github/workflows/ci.yml` runs on every push and pull request:

**Frontend job:**
1. Checkout
2. Setup Node 24
3. `npm ci`
4. `npm run type-check`
5. `npm run test`
6. `npm run build`

**Backend job (when `backend/composer.json` exists):**
1. Checkout
2. Setup PHP 8.4 + extensions
3. PostgreSQL 16 service (health-checked)
4. Redis 7 service (health-checked)
5. `composer install`
6. `php artisan key:generate`
7. `php artisan migrate`
8. `vendor/bin/pest --coverage --min=50` (or phpunit fallback)

## E2E (future)

Playwright tests for critical flows: login → student creation → parent
linking → teacher assignment → attendance → results → invoices →
admissions → report cards.

## Seed data

Use repeatable fake data (factories + seeders). Never use real student
data in development, staging or tests.
