/**
 * Staff document library (README §23, Phase 14B).
 *
 * Documents are R2 objects with D1 metadata. The table follows the v2
 * spec's polymorphic `owner_type` / `owner_id` design so the same
 * store can hold school-wide documents (owner_type 'school',
 * owner_id null) and staff-attached documents (owner_type 'staff',
 * owner_id = staff_profiles.id). Phase 14B ships the school-wide
 * library; per-staff attachment uses the same columns.
 *
 * Visibility controls who can read a document: 'staff' means any
 * authenticated staff member (admin/teacher); 'admin' restricts to
 * admins. Documents are never public — bytes are always served
 * through the authorized download endpoint.
 */
import {
  sqliteTable,
  text,
  integer,
  index,
} from 'drizzle-orm/sqlite-core'
import { users } from './core'
import { documentVisibilityEnum } from './enums'

export const documents = sqliteTable(
  'documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerType: text('owner_type').notNull().default('school'),
    ownerId: text('owner_id'),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category'),
    visibility: documentVisibilityEnum('visibility')
      .default('staff')
      .notNull(),
    createdById: text('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    ownerIdx: index('documents_owner_idx').on(t.ownerType, t.ownerId),
    visibilityIdx: index('documents_visibility_idx').on(t.visibility),
    categoryIdx: index('documents_category_idx').on(t.category),
  }),
)
