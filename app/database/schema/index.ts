/**
 * Drizzle schema — foundation tables.
 *
 * This is the Phase 0 foundation: users, roles, permissions, and the
 * join tables. The full schema (students, academics, finance, etc.)
 * is added in Phase 1 following the README §40 migration order.
 *
 * Conventions:
 *  - All money uses numeric() — never float/real.
 *  - All tables have created_at / updated_at timestamps.
 *  - Foreign keys on every relationship.
 *  - Meaningful unique constraints.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  boolean,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    password: text('password').notNull(),
    phone: varchar('phone', { length: 50 }),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').default(true).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
)

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('roles_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    group: varchar('group', { length: 100 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('permissions_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Role <-> Permission (many-to-many)
// ---------------------------------------------------------------------------
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
)

// ---------------------------------------------------------------------------
// User <-> Role (many-to-many)
// ---------------------------------------------------------------------------
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
    userIdx: index('user_roles_user_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// School settings (key/value)
// ---------------------------------------------------------------------------
export const schoolSettings = pgTable(
  'school_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 200 }).notNull(),
    value: text('value'),
    type: varchar('type', { length: 50 }).default('string').notNull(),
    group: varchar('group', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    keyIdx: uniqueIndex('school_settings_key_idx').on(t.key),
  }),
)

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  description: text('description'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: text('metadata'), // JSON string
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Export all tables as a schema object for convenience
export const schema = {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  schoolSettings,
  auditLogs,
}
