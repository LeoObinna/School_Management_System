# Phase 10 — Communication/events: Implementation Plan

## Context

Phase 9 (Admissions) is complete. The database tables for Phase 10 already exist (created in Phase 0/1 foundation): `announcements`, `notifications`, `messages`, `events`, `galleryAlbums`, `galleryImages` — with enums `publicationStatusEnum`, `audienceEnum`, `notificationStatusEnum`, `messageDirectionEnum`. No migration is needed.

No services, routes, pages, schemas, or types exist for Phase 10 yet. Permission slugs for announcements/notifications/messages are already in the catalog; `events.*` and `gallery.*` must be added.

## Scope

**Include:** Announcements (CRUD + publish with notification fan-out + archive), Notifications (list/mark-read/delete, scoped to own user), Messages (send/list/mark-read, internal user-to-user), Events (CRUD), Gallery albums + images (CRUD + R2 upload/download/delete).

**Defer:** Learning resources (Phase 7 territory), Queue consumer for async email (Phase 12), thumbnail/optimization pipeline (Phase 12), public events/gallery website (Phase 14).

## Key design decisions

1. **Notification fan-out**: When an announcement is published, notification rows are created synchronously inside the same transaction via `INSERT INTO notifications SELECT ... FROM users JOIN user_roles JOIN roles WHERE audience match`. No Queue consumer is declared yet (producer binding reserved in wrangler.toml for Phase 12).
2. **Audience → role mapping**: `all`→everyone, `admins`→super_admin+admin, `staff`→super_admin+admin, `teachers`→teacher, `students`→student, `parents`→parent.
3. **Gallery R2**: Same 503-in-Node-dev pattern as admissions documents — use `npm run cf:dev` or deployed env.
4. **Message recipient**: `messageCreateSchema` takes `recipientId` (UUID). Route also accepts `recipientEmail` and resolves it server-side to avoid a user-search endpoint.
5. **Events status**: Simple `draft`/`published`/`cancelled` — no complex workflow.

## Implementation steps (ordered)

### 1. Permission catalog — `app/database/seeds/catalog.ts`
- Add `events.view`, `events.manage`, `gallery.view`, `gallery.manage` to `PERMISSION_SLUGS`
- Grant `events.view`/`gallery.view` to teacher, student, parent role arrays
- Extend catalog test `app/database/seeds/__tests__/catalog.test.ts`

### 2. Upload category — `app/server/utils/uploads.ts`
- Add `gallery_image: 25 * 1024 * 1024` to `UPLOAD_LIMITS` and union
- Extend upload tests with accept/reject cases

### 3. Shared schemas — 2 new files
- `app/shared/schemas/communication.ts`: announcement create/update/list-query, notification list-query, message create/list-query
- `app/shared/schemas/events.ts`: event create/update/list-query, album create/update/list-query, gallery image caption
- Barrel export from `app/shared/schemas/index.ts`
- Schema tests: `app/shared/__tests__/communication.test.ts`, `app/shared/__tests__/events.test.ts`

### 4. Shared types — append to `app/shared/types/index.ts`
- `AnnouncementStatus`, `Audience`, `NotificationStatus`, `MessageDirection`, `EventStatus`
- `Announcement`/`AnnouncementListItem`, `Notification`/`NotificationListItem`, `Message`/`MessageListItem`
- `SchoolEvent`/`SchoolEventListItem`, `GalleryAlbum`/`GalleryAlbumListItem`/`GalleryAlbumDetail`, `GalleryImage`

### 5. Server services — 2 new files
- `app/server/services/communication.ts`: list/get/create/update/delete/publish/archive announcements, list/mark-read/mark-all-read/delete notifications, list/get/send/mark-read messages
- `app/server/services/events.ts`: list/get/create/update/delete events, list/get/create/update/delete albums, add-image/get-image-for-download/delete-image

### 6. API routes — 28 files under `app/server/api/v1/`
**Announcements** (7): `index.get`, `index.post`, `[id].get`, `[id].put`, `[id].delete`, `[id]/publish.post`, `[id]/archive.post`
**Notifications** (4): `index.get`, `read-all.post`, `[id]/read.post`, `[id].delete`
**Messages** (4): `index.get`, `index.post`, `[id].get`, `[id]/read.post`
**Events** (5): `index.get`, `index.post`, `[id].get`, `[id].put`, `[id].delete`
**Gallery** (8): `albums/index.get`, `albums/index.post`, `albums/[id].get`, `albums/[id].put`, `albums/[id].delete`, `albums/[id]/images/index.post` (multipart), `albums/[id]/images/[imageId].get` (stream), `albums/[id]/images/[imageId].delete`

### 7. Client services — 2 new files
- `app/services/communication.ts`: `announcementsApi`, `notificationsApi`, `messagesApi`
- `app/services/events.ts`: `eventsApi`, `galleryApi` (with `imageUrl()` helper)

### 8. Pages — 5 new files
- `app/pages/announcements.vue` — list + create/edit modal + publish/archive/delete
- `app/pages/notifications.vue` — own notifications + mark-read/mark-all-read/delete
- `app/pages/messages.vue` — inbox + compose (recipient by email) + detail + mark-read
- `app/pages/events.vue` — list + create/edit modal + delete
- `app/pages/gallery.vue` — albums grid + album detail + image upload/download/delete

### 9. Dashboard — `app/pages/index.vue`
- "Communication" section (announcements/notifications/messages links)
- "Events & gallery" section (events/gallery links)

### 10. wrangler.toml
- Add `NOTIFICATION_QUEUE` producer bindings for local/staging/production (no consumer yet)

### 11. Seeds — `app/database/seeds/index.ts`
- 4 announcements (published/draft/archived), 5 notifications, 3 messages, 3 events, 2 albums with placeholder images
- Idempotent, fake data only

### 12. Docs
- `docs/API.md`: Phase 10 section with route tables, audience→role mapping, R2 503 note
- `README.md`: Phase 10 entry → COMPLETE, §47 status, §51 changelog
- `docs/ARCHITECTURE.md`: status header → Phases 0–10

## Verification
1. `npm run db:seed` (adds new permissions + seed data)
2. psql: verify announcements, notifications, messages, events, gallery tables
3. `npm run test` (expect ~245+ tests)
4. `npm run type-check`
5. `npm run build`
6. Dev-server smoke: all Phase 10 endpoints return 401 unauthenticated

## Known limitations
- Queue producer binding declared but unused (Phase 12 async email)
- No thumbnail pipeline (Phase 12)
- Gallery upload/download 503 under `npm run dev` (use `npm run cf:dev`)
- Learning resources deferred (Phase 7 territory)
- No user-search endpoint; message recipient resolved by email
