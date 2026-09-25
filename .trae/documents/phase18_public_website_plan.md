# Phase 18 — Public Website Implementation Plan

> Status: awaiting owner approval. Phases 15 (Paystack), 16 (portals) and
> 17 (email/SMS) are explicitly deferred; Phase 18 proceeds now.
> Work is delivered in four increments (18A→18D), each independently
> green (type-check, vitest, build, cf:dev smoke, docs).

## Owner decisions (2026-09-25)

1. **Routing move approved** — public site owns `/`; dashboard → `/dashboard`;
   staff pages clashing with marketing URLs move under `/manage/`.
2. **Placeholders approved** — About/hero/etc. ship with clearly marked,
   editable placeholder copy using only canonical facts (school name,
   motto "Not to Equal, But to Excel", Ojodu, Lagos). Staff profiles are
   excluded (no consent flag exists).
3. **Result checker identity** — admission number + surname + session + term.
4. **Extras** — include the **contact-message inbox** (table + admin page).
   Exclude: Turnstile (honeypot + KV rate limits instead), PDF
   prospectus/forms, publishing the fee schedule.

## Repository Research

- One Nuxt 4 app deploys as a single Cloudflare Worker + Static Assets
  (`cloudflare-module` preset, `ASSETS` binding). Public pages need no new
  infrastructure; they are Nuxt pages with `definePageMeta({ public: true })`
  (the global client guard in `app/middleware/auth.global.ts` already honours
  `meta.public`). No `layouts/` directory exists today, so adding only
  `layouts/public.vue` leaves every portal page rendering exactly as now
  (a `default.vue` would otherwise be auto-applied — do not create one).
- `/` is currently the dashboard (`app/pages/index.vue`). Staff pages that
  own marketing URLs today: `pages/admissions.vue`, `pages/events.vue`,
  `pages/gallery.vue`, `pages/announcements.vue`. Links into them exist only
  on the dashboard (4 links) plus many "← Dashboard" `to="/"` links across
  portal pages — all must be grepped and repointed to `/dashboard`.
  `pages/results.vue` (student/parent) coexists safely with a new
  `pages/results/checker.vue` (Nuxt allows a route file and same-named folder).
- Reusable data/service foundations:
  - `getPublicSchoolSettings()` (school-settings service) — identity subset;
    currently exposed only at authenticated `GET /my/school-settings`.
  - Announcements `status published` + `audience all`, events
    `status published`, `galleryAlbums.isPublished` (default true) +
    `galleryImages` R2 keys with `thumbObjectKey`. Current gallery image
    route requires `gallery.view` — a public published-only streamer is new.
  - `createApplication(input)` in the admissions service takes no actor and
    auto-numbers `APP-YYYY-NNNN`; the staff check lives only in the route.
  - `result_publications` (unique per session/term/class/section) gates
    scores with status `published`; `getStudentResults()` in the exams
    service contains the published-only score loading logic to factor out.
  - KV-backed sliding-window limiter `checkRateLimit(event, scope, key)` —
    scopes are a fixed union; new public-form scopes need window ≥ 60 s.
  - `streamObject()` for R2, `getOrSet()` KV cache helper, cache util,
    `sendCsv`-style helpers, `parseInput`/zod patterns all established.
- Students have `admissionNumber` (unique) and `lastName` — the result
  checker identity factors. Active enrollment links student→session→class.
- Contact submissions have **no storage today** → migration 0003 +
  `contact_messages` table + one new admin permission (re-seed required).
- CSRF: verify the Nitro server middleware's CSRF enforcement before
  building public POSTs. Session-cookie CSRF must not block unauthenticated
  public POSTs from our own origin; same-origin checks are expected to pass.
- Generated imagery must use the text-to-image API URL pattern
  (`.../text_to_image?prompt=...&image_size=landscape_16_9`); R2 gallery
  images are served by our own streaming route.

## Files and Modules

### Routing / shell
- `app/pages/index.vue` → **move** to `app/pages/dashboard.vue` (mark
  portal chrome; update its 4 nav links).
- Move: `pages/admissions.vue`→`pages/manage/admissions.vue`,
  `pages/events.vue`→`pages/manage/events.vue`,
  `pages/gallery.vue`→`pages/manage/gallery.vue`,
  `pages/announcements.vue`→`pages/manage/announcements.vue`.
- Repoint every `to="/"` / `to="/admissions|events|gallery|announcements"`
  in portal pages (`grep`) to `/dashboard` / `/manage/...`.
- `app/pages/auth/login.vue`: default redirect and "Go to dashboard" → `/dashboard`.
- New public pages: `pages/index.vue` (home), `about.vue`, `academics.vue`,
  `admissions.vue`, `fees.vue`, `news/index.vue`, `news/[id].vue`,
  `events.vue`, `gallery.vue`, `contact.vue`, `results/checker.vue`.
- `app/layouts/public.vue`; components under `app/components/public/`
  (SiteHeader, SiteFooter, HeroSection, StatStrip, QuickActions,
  SectionHeading, NewsCard, EventCard, AlbumCard, LevelCard, FaqAccordion,
  AdmissionWizard, StatusChecker, ResultChecker, ContactForm,
  GalleryLightbox).
- `app/assets/css/main.css`: add VCS brand tokens (blue `#1A237E`,
  gold `#C9A84C`, red `#B22234`, cream `#F8F4E8`, ink `#1A1A2E`) without
  changing existing tokens; system font stack (no new webfont dependency).
- `app/nuxt.config.ts`: default document title → school name.

### Shared contracts
- `app/shared/schemas/public.ts`: `publicApplicationSchema` (strict subset
  with honeypot `_website` that must be empty), `admissionStatusQuerySchema`
  (applicationNumber + guardianEmail|phone), `contactMessageCreateSchema`,
  `publicResultCheckSchema` (admissionNumber, surname, sessionId, termId),
  news/events/gallery list query schemas.
- Types in `app/shared/types/`: PublicSettings, PublicStats, PublicNews,
  PublicEvent, PublicAlbum/PublicImage, PublicAcademics, PublicResultSummary,
  ContactMessage.

### Server — new `/api/v1/public/*` group (all unauthenticated)
- `public/school-settings.get.ts` (+ bank fields, UI hides them when empty),
  `public/logo.get.ts` (R2 stream, long cache),
  `public/stats.get.ts` (aggregate counts, KV-cached).
- `public/news/index.get.ts`, `public/news/[id].get.ts`
  (published + audience all only; text rendered as text, never v-html).
- `public/events/index.get.ts` (published; upcoming/past).
- `public/gallery/albums.get.ts`, `albums/[id].get.ts`,
  `images/[imageId].get.ts` (published-album verification, thumb support,
  public cache headers).
- `public/academics.get.ts` (current session/terms, active classes,
  subject names per class — no people data).
- `public/admissions/applications.post.ts` (rate limit, honeypot,
  reuses `createApplication`; returns only `applicationNumber`),
  `public/admissions/status.get.ts` (exact match on number + guardian
  email/phone; returns status label only; generic 404).
- `public/contact.post.ts` (rate limit, honeypot, persists message).
- `public/results/check.post.ts` (admission number + surname + session +
  term; published publication row required; generic failure message;
  rate limit). New `getPublicPublishedResult()` in the exams service,
  sharing the score-loading core with `getStudentResults`.
- Root routes `server/routes/robots.txt.ts` and `server/routes/sitemap.xml.ts`.
- Helpers: public `Cache-Control` setter; new `RATE_LIMIT_RULES` scopes
  (`public-admission` 5/3600, `public-admission-status` 20/600,
  `public-contact` 3/600, `public-result-check` 10/600) keyed by IP.

### Contact inbox (18C)
- Migration `app/database/migrations/0003_contact_messages.sql`
  (id, name, email, phone, department, subject, body, status
  new|read|archived, created_at, read_at; index on status/created_at).
- `server/services/contact-messages.ts` (public create; staff list/get/
  mark-read/archive), routes under `/api/v1/contact-messages`,
  permission `contact_messages.view` (admin only) in the seed catalog
  (local `npm run db:seed` required), client service,
  `pages/manage/contact-messages.vue`, dashboard admin link, audit on
  staff actions.

### Public client
- `app/services/public.ts`: typed functions over `/api/v1/public` used
  through `useFetch`/`useAsyncData` so SSR renders inside the Worker.
- `app/composables/usePublicSeo.ts`: title/description/OG defaults per page.

## Implementation Steps (dependency order)

### Increment 18A — Foundation, routing, home
1. Add brand tokens; create `layouts/public.vue` + header/footer shell +
   public SEO composable; generated hero image asset.
2. Move dashboard and four staff pages; repoint all internal links and
   login redirect; grep-verify no stale portal links.
3. Public APIs: settings, logo, stats (+ cache helper, KV caching);
   add rate-limit scopes.
4. Build the homepage per UI brief section 6 order.
5. Unit tests (settings/stats mappers, new rate-limit windows, link/route
   sanity); gates; cf:dev smoke (anonymous home, portal redirects,
   dashboard move); docs (API.md 18A, README).

### Increment 18B — Content sections
6. Public news (+ detail), events, gallery (incl. published-only image
   streaming with thumbs), academics APIs and pages.
7. About and Fees pages with placeholders (fees: instructions + bank
   block only when settings populated; Pay Fees → portal login).
8. Tests: publication/audience gates, published-album-only image
   authorization, class/subject mapping; gates; smoke; docs.

### Increment 18C — Admissions + contact
9. Migration 0003 + contact service/routes/permission + seed re-run +
   admin inbox page.
10. Public application wizard (multi-step, per-step validation, review,
    APP-number success) + status checker; public POST endpoints with
    honeypot + rate limits (verify CSRF middleware behavior first).
11. Contact page form + FAQ + map embed (rendered only when address set).
12. Tests: honeypot, schema boundaries, number-only response, status
    exact-match, contact lifecycle, 429 behavior; gates; smoke; docs.

### Increment 18D — Result checker, SEO, hardening
13. Public result service/endpoint/page (publication gate, surname match,
    generic errors, rate limit; reuses published score core).
14. robots.txt, sitemap.xml (static + dynamic news/album URLs), favicon,
    public-branded error/404 state, reduced-motion/aria pass, empty/
    loading/error states.
15. End-to-end privacy review: every public endpoint denies drafts,
    unpublished rows, private files and any student PII beyond the
    consented checker; final gates, full cf:dev smoke, complete docs
    (API.md Phase 18, README §41/§46/§47 + changelog).

## Dependencies and Considerations
- No new providers: no Paystack (15), no email sends (17), no Turnstile.
- One new permission + migration in 18C → `npm run db:seed` against local
  D1; demo/fake data only.
- Public forms rely on same-origin + honeypot + KV sliding-window limits;
  WAF-level hardening remains Phase 19.
- Plain `nuxt dev` lacks R2 (logo/gallery images 503 there) — use
  `npm run cf:dev` for smoke, as in earlier phases.
- SSR data must come through Nitro internal `$fetch`/`useFetch`, not the
  cookie-bound client api wrapper.
- All money/curriculum/policy facts remain settings/database driven;
  placeholders never assert invented facts.
- Manual Wrangler deploys only; nothing committed or deployed without
  explicit instruction.

## Validation (per increment and final)
- `npm run type-check`, `npm run test`, `npm run build` all exit 0.
- cf:dev anonymous checks: public 200s and SSR render; drafts/unpublished/
  private images return 404/403; result checker 404 for unpublished and
  wrong surname; wizard/contact return 429 past limits; portal flows
  (login redirect, dashboard nav, moved pages) all work.
- Accessibility/visual pass per UI brief §19 (keyboard, labels, alt text,
  focus, reduced motion, responsive desktop/tablet).
- Docs updated: `docs/API.md`, README phase sections + changelog.

## Risks
- **CSRF on public POSTs** — inspect middleware first; if it enforces the
  session CSRF token globally, exempt the `/api/v1/public/*` write group
  (no ambient authority cookie is involved) while keeping origin checks.
- **Broken internal links from the routing move** — mitigated by
  exhaustive grep + smoke of every dashboard card.
- **Result enumeration** — generic responses, surname factor, IP limits.
- **Bandwidth abuse of public images** — published-only, cache headers,
  no enumerable private keys; WAF deferred to Phase 19.
- **Placeholder content accidentally reading as fact** — every placeholder
  is visually marked and lives in editable page copy, using canonical
  facts only.
- **Route/file coexistence** (`results.vue` + `results/`) — verified Nuxt
  supports it; confirm with build in 18A.
