# API Design

## Conventions

- Base path: `/api/v1`
- Content-Type: `application/json`
- Authentication: Laravel Sanctum (cookie-based for SPA, token-based for API)
- Pagination: cursor or offset with `page` / `per_page` params
- Error format: normalized JSON (see below)

## Error response format

```json
{
  "message": "Human-readable summary",
  "errors": {
    "field_name": ["Validation message"]
  }
}
```

HTTP status codes:

| Code | Meaning                              |
|------|--------------------------------------|
| 200  | OK                                   |
| 201  | Created                              |
| 204  | No content (delete)                  |
| 400  | Bad request                          |
| 401  | Unauthenticated                      |
| 403  | Forbidden (authorization failed)     |
| 404  | Not found                            |
| 422  | Validation error                     |
| 429  | Rate limited                         |
| 500  | Server error (never expose SQL/trace)|

## Endpoints (Phase 0 — planned)

### Auth

``` text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### Health

``` text
GET /api/v1/health      # { status: "ok", db: "ok", redis: "ok" }
```

### Core resources (Phase 2+)

See README §24 for the full resource list. Endpoints will be documented
here as each phase is implemented.

## Frontend integration

The Vue frontend calls all APIs through `frontend/src/services/api.ts`
(a centralized Axios instance). Components never call `axios` or `fetch`
directly. Domain services (`services/*.ts`) wrap endpoints and return
typed promises.

In development, Vite proxies `/api` to the Laravel server (port 8000 in
the Codespace).
