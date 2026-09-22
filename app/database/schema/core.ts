/**
 * Core identity & access tables.
 *
 * users, roles, permissions, join tables, school settings, audit logs.
 * Follows README §12 and the dependency order in README §40.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted this file from
 * PostgreSQL (`pgTable` + `uuid`/`varchar`/`timestamp`/`boolean`) to
 * SQLite/D1 (`sqliteTable` + `text` IDs + `text` ISO-8601 timestamps
 * + `integer` 0/1 booleans). The 5-table RBAC shape (users, roles,
 * permissions, role_permissions, user_roles) is preserved verbatim
 * per migration decision D3 — no flattening to a single users.role
 * column. Sessions stay stateless signed cookies + KV revocation
 * (decision D4); there is NO sessions table here.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { genderEnum } from './enums'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    phone: text('phone'),
    gender: genderEnum('gender'),
    avatarUrl: text('avatar_url'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    emailVerifiedAt: text('email_verified_at'),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
)

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const roles = sqliteTable(
  'roles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    isSystem: integer('is_system', { mode: 'boolean' })
      .default(false)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('roles_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
export const permissions = sqliteTable(
  'permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    group: text('group'),
    description: text('description'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('permissions_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Role <-> Permission (many-to-many)
// ---------------------------------------------------------------------------
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
)

// ---------------------------------------------------------------------------
// User <-> Role (many-to-many)
// ---------------------------------------------------------------------------
export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
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
export const schoolSettings = sqliteTable(
  'school_settings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text('key').notNull(),
    value: text('value'),
    type: text('type').default('string').notNull(),
    group: text('group'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    keyIdx: uniqueIndex('school_settings_key_idx').on(t.key),
  }),
)

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    description: text('description'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata'), // JSON string
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    userIdx: index('audit_logs_user_idx').on(t.userId),
    resourceIdx: index('audit_logs_resource_idx').on(t.resource, t.resourceId),
    createdIdx: index('audit_logs_created_idx').on(t.createdAt),
  }),
)
