/**
 * Inventory ledger (README §41 Phase 14C, v2 schema §15 library_books).
 *
 * A stock catalog of books and equipment. Each row is a bulk-tracked
 * item with a total `quantity` and an `available_quantity` (units that
 * can be issued/used; quantity − available reflects withheld or
 * in-circulation units). Phase 14C is the ledger only — issuing/loans
 * to students are a later increment; even so, available_quantity lets
 * staff record write-offs/damaged-withheld stock. The service enforces
 * 0 <= available_quantity <= quantity.
 *
 * Retired items are retained for history (never hard-deleted by normal
 * operation); explicit DELETE remains for erroneous entries.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { users } from './core'
import {
  inventoryConditionEnum,
  inventoryItemTypeEnum,
  inventoryStatusEnum,
} from './enums'

export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    itemType: inventoryItemTypeEnum('item_type')
      .default('book')
      .notNull(),
    category: text('category'),
    // ISBN for books, asset tag/serial for equipment.
    identifier: text('identifier'),
    quantity: integer('quantity').default(1).notNull(),
    availableQuantity: integer('available_quantity')
      .default(1)
      .notNull(),
    location: text('location'),
    condition: inventoryConditionEnum('condition')
      .default('good')
      .notNull(),
    status: inventoryStatusEnum('status')
      .default('active')
      .notNull(),
    notes: text('notes'),
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
    // A given physical reference (type + identifier) is one catalog row;
    // items without an identifier can repeat, so the index is partial-ish
    // via treating null identifier as a non-conflicting value (SQLite
    // treats NULLs as distinct in unique indexes), which matches intent.
    identifierIdx: uniqueIndex('inventory_items_identifier_idx').on(
      t.itemType,
      t.identifier,
    ),
    typeIdx: index('inventory_items_type_idx').on(t.itemType),
    categoryIdx: index('inventory_items_category_idx').on(t.category),
    statusIdx: index('inventory_items_status_idx').on(t.status),
  }),
)
