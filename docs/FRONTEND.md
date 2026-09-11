# Frontend

Status: **Phase 0 foundation.** No business modules yet.

## Stack

- Vue 3 (Composition API, `<script setup lang="ts">`)
- TypeScript in strict mode (`strict`, `noUncheckedIndexedAccess`)
- Vite 8 (dev server, production build)
- Vue Router 4 (HTML5 history mode, lazy-loaded routes)
- Pinia 3 (shared state only — not every API response)
- Tailwind CSS 4 (CSS-first `@theme` design tokens)
- Axios via a single centralized API client
- Vitest 5 + @vue/test-utils + jsdom

## Commands

```bash
cd frontend
npm install
npm run dev          # dev server on http://localhost:5173, /api proxied to :8000
npm run test         # Vitest one-shot run
npm run test:watch   # Vitest watch mode
npm run type-check   # vue-tsc --build
npm run build        # type-check + production build into dist/
```

## Structure

```text
frontend/src/
├── components/ui/          # Design-system primitives (BaseButton, BaseCard, BaseBadge)
├── layouts/AppLayout.vue   # Application shell: sidebar (desktop) / collapsible nav (mobile)
├── router/index.ts         # Route table, document titles, scroll behavior
├── services/
│   ├── api.ts              # Central axios instance + normalized error handling
│   └── health.ts           # Health endpoint domain service
├── stores/health.ts        # Example Pinia store (data/loading/error pattern)
├── types/api.ts            # Shared API response types
├── views/                  # HomeView, HealthView, NotFoundView
├── App.vue
├── main.ts
└── style.css               # Tailwind import + design tokens
```

## Conventions

- All HTTP goes through `services/api.ts`; components never call axios/fetch
  directly. Domain services (`services/*.ts`) wrap endpoints and return
  typed promises.
- Asynchronous state in stores follows the `data` / `loading` / `error`
  pattern; pages render explicit loading, empty, error and success states.
- Interactive elements use the `components/ui` primitives and design tokens
  — no ad-hoc color values in pages.
- The `@/*` path alias maps to `src/*` and is mirrored in
  `vite.config.ts` and `tsconfig.app.json`.

## API access

- API base URL comes from `VITE_API_BASE_URL` (see `.env.example`, default
  `/api/v1`).
- In development Vite proxies `/api` to `http://127.0.0.1:8000` (Laravel).
- `withCredentials: true` is set for future Sanctum cookie auth; no auth
  is implemented in Phase 0.

## Design system

Tokens are defined in `src/style.css` via Tailwind v4 `@theme`: brand color
scale, neutral surfaces/content colors, radius and the system font stack.
The shell is responsive (sidebar on desktop, collapsible top navigation on
mobile), uses semantic markup and visible keyboard focus. Phase 0 ships
only three primitives; tables, modals, forms and the rest are added by
phase as needed rather than all upfront.
