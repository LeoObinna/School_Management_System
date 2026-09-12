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
- File access authorization (private R2 objects streamed via authorized API)
- Audit logging of sensitive operations

## Local quality gate (replaces CI)

There is no CI pipeline. Run the full gate locally from `app/` before
every deploy (and ideally before every commit):

``` text
npm run test         # Vitest (jsdom; no running database required)
npm run type-check   # nuxt typecheck (strict TypeScript)
npm run build        # cloudflare-module Worker build
```

Deployment is then manual:

``` text
npm run deploy:staging      # or deploy:production
```

GitHub is source control only — a push never builds or deploys.

## E2E (future)

Playwright tests for critical flows: login → student creation → parent
linking → teacher assignment → attendance → results → invoices →
admissions → report cards.

## Seed data

Use repeatable fake data (factories + seeders). Never use real student
data in development, staging or tests.
