/**
 * Admin user-management service (Phase 6).
 *
 * List/get/create/update/soft-delete LOGIN accounts, admin-initiated
 * password reset, and replacement of a user's role set. Person-creation
 * flows (POST /students etc.) keep their own implicit user-creation
 * paths; this service is the explicit admin surface that PRD §5 lists
 * as a gap.
 *
 * Mutations do NOT call writeAudit themselves — the route layer writes
 * the audit entry so action descriptions stay close to the HTTP verb
 * (matches the people.ts pattern).
 */
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  users,
  roles,
  userRoles,
  rolePermissions,
  permissions,
} from '../../database/schema'
import type {
  UserCreate,
  UserListQuery,
  UserRolesUpdate,
  UserUpdate,
} from '../../shared/schemas'
import type {
  RoleListItem,
  RoleDetail,
  UserDetail,
  UserListItem,
} from '../../shared/types'
import {
  isForeignKeyViolation,
  isUniqueViolation,
  smsConflict,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import { hashPassword } from '../utils/auth/password'
import { loadUserGrants } from '../utils/auth/context'
import { runBatch, type D1BatchItem, type SmsDb } from '../utils/pagination'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// Escapes a user search term for a LIKE pattern (mirrors people.ts).
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, '\\$&')}%`
}

const activeUser = isNull(users.deletedAt)

interface UserListRow {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
  // SQLite group_concat: comma-joined distinct role slugs, or NULL.
  roles: string | null
}

function splitSlugs(joined: string | null): string[] {
  return joined ? joined.split(',').filter(Boolean) : []
}

// ---------------------------------------------------------------------------
// List + detail
// ---------------------------------------------------------------------------

export async function listUsers(query: UserListQuery) {
  const client = await db()

  // Build the WHERE; the role filter requires an EXISTS subquery against
  // user_roles→roles so a user with multiple roles still appears once.
  const where: SQL[] = [activeUser]
  if (query.isActive !== undefined) {
    where.push(eq(users.isActive, query.isActive))
  }
  if (query.role) {
    // Correlated EXISTS against literal table names (matches the raw-SQL
    // convention in auth/context.ts). ${users.id} resolves to the outer
    // users row; the subquery itself introduces ur/r aliases.
    where.push(
      sql`EXISTS (SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ${users.id} AND r.slug = ${query.role})`,
    )
  }
  if (query.search) {
    const pattern = likePattern(query.search)
    const searchExpr = or(
      like(users.name, pattern),
      like(users.email, pattern),
    )
    if (searchExpr) {
      where.push(searchExpr)
    }
  }

  const totalRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(users)
    .where(and(...where))
  const total = Number(totalRows[0]?.n) || 0

  const offset = (query.page - 1) * query.perPage
  const rows = await client
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatar_url: users.avatarUrl,
      is_active: users.isActive,
      email_verified_at: users.emailVerifiedAt,
      last_login_at: users.lastLoginAt,
      created_at: users.createdAt,
      updated_at: users.updatedAt,
      roles: sql<string | null>`group_concat(DISTINCT ${roles.slug})`,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(...where))
    .groupBy(users.id)
    .orderBy(asc(users.name))
    .limit(query.perPage)
    .offset(offset)

  const data: UserListItem[] = (rows as unknown as UserListRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    isActive: r.is_active,
    emailVerifiedAt: r.email_verified_at,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    roles: splitSlugs(r.roles),
  }))

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getUserOrThrow(id: string): Promise<UserDetail> {
  const client = await db()
  const [row] = await client
    .select()
    .from(users)
    .where(and(eq(users.id, id), activeUser))
    .limit(1)
  if (!row) {
    throw smsNotFound('User not found.')
  }
  // Reuse the auth-context grant loader so permissions stay consistent
  // with what the route layer enforces (super_admin wildcard, etc.).
  const grants = await loadUserGrants(id)
  if (!grants) {
    // Soft-deleted between the two reads above; treat as not found.
    throw smsNotFound('User not found.')
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    roles: grants.roles,
    permissions: grants.permissions,
  }
}

// ---------------------------------------------------------------------------
// Create / update / soft-delete
// ---------------------------------------------------------------------------

export async function createUser(input: UserCreate): Promise<UserDetail> {
  const client = await db()
  const passwordHash = await hashPassword(input.password)
  try {
    const [row] = await client
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        password: passwordHash,
        phone: input.phone || null,
        gender: input.gender ?? null,
        isActive: input.isActive ?? true,
      })
      .returning({ id: users.id })
    if (!row) {
      throw smsConflict('Could not create user.')
    }
    return getUserOrThrow(row.id)
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw smsConflict('A user with this email already exists.')
    }
    throw e
  }
}

export async function updateUser(
  id: string,
  input: UserUpdate,
): Promise<UserDetail> {
  const client = await db()
  await getUserOrThrow(id)
  const values: Record<string, unknown> = {
    ...input,
    updatedAt: new Date().toISOString(),
  }
  if (input.password) {
    values.password = await hashPassword(input.password)
  }
  if (input.phone === '') {
    values.phone = null
  }
  if (input.gender === undefined) {
    delete values.gender
  }
  try {
    await client
      .update(users)
      .set(values)
      .where(and(eq(users.id, id), activeUser))
    return getUserOrThrow(id)
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw smsConflict('A user with this email already exists.')
    }
    throw e
  }
}

/** Admin-initiated password reset; the route writes the audit entry. */
export async function adminResetPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  const client = await db()
  await getUserOrThrow(id)
  const passwordHash = await hashPassword(newPassword)
  await client
    .update(users)
    .set({ password: passwordHash, updatedAt: new Date().toISOString() })
    .where(and(eq(users.id, id), activeUser))
}

/**
 * Replaces the user's role set. Validates that every roleId exists and
 * refuses to leave a user with zero roles — the caller passes a
 * non-empty array (enforced by the schema), but we additionally verify
 * each id is a real role row.
 */
export async function setUserRoles(
  id: string,
  input: UserRolesUpdate,
): Promise<UserDetail> {
  const client = await db()
  await getUserOrThrow(id)

  const roleRows = await client
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, input.roleIds))
  if (roleRows.length !== input.roleIds.length) {
    throw smsFieldError('roleIds', 'One or more roles do not exist.')
  }

  // Delete existing grants then insert the new set inside one D1 batch
  // (single transaction). Drizzle's batch tuple typing is non-empty; we
  // accumulate a mutable array of thenable builders and cast each to
  // D1BatchItem (matches the finance.ts pattern).
  const inserts: D1BatchItem[] = [
    client
      .delete(userRoles)
      .where(eq(userRoles.userId, id)) as unknown as D1BatchItem,
  ]
  for (const roleId of input.roleIds) {
    inserts.push(
      client
        .insert(userRoles)
        .values({ userId: id, roleId }) as unknown as D1BatchItem,
    )
  }
  await runBatch(client, inserts)

  return getUserOrThrow(id)
}

/**
 * Soft-deletes a user account: marks `deleted_at` and `is_active=false`.
 * The row stays in the table so audit_logs.user_id (ON DELETE SET NULL
 * aside) and historical references remain resolvable. Person profiles
 * that pointed at this userId keep their existing link.
 */
export async function softDeleteUser(id: string): Promise<void> {
  const client = await db()
  await getUserOrThrow(id)
  await client
    .update(users)
    .set({
      isActive: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(users.id, id), activeUser))
}

// ---------------------------------------------------------------------------
// Roles viewer (read-only — seeder is the source of truth)
// ---------------------------------------------------------------------------

interface RoleListRow {
  id: string
  name: string
  slug: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
  permission_count: number
}

export async function listRoles(): Promise<RoleListItem[]> {
  const client = await db()
  const rows = await client
    .select({
      id: roles.id,
      name: roles.name,
      slug: roles.slug,
      description: roles.description,
      is_system: roles.isSystem,
      created_at: roles.createdAt,
      updated_at: roles.updatedAt,
      permission_count: sql<number>`cast(count(${rolePermissions.permissionId}) as integer)`,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.name))

  return (rows as unknown as RoleListRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystem: r.is_system,
    permissionCount: r.permission_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function getRoleDetailOrThrow(
  id: string,
): Promise<RoleDetail> {
  const client = await db()
  const [roleRow] = await client
    .select()
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1)
  if (!roleRow) {
    throw smsNotFound('Role not found.')
  }

  const permRows = await client
    .select({
      slug: permissions.slug,
      name: permissions.name,
      group: permissions.group,
    })
    .from(rolePermissions)
    .innerJoin(
      permissions,
      eq(permissions.id, rolePermissions.permissionId),
    )
    .where(eq(rolePermissions.roleId, id))
    .orderBy(asc(permissions.group), asc(permissions.slug))

  // Pull the count from the same join shape so the list/detail counts
  // cannot drift.
  const [countRow] = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, id))

  return {
    id: roleRow.id,
    name: roleRow.name,
    slug: roleRow.slug,
    description: roleRow.description,
    isSystem: roleRow.isSystem,
    permissionCount: Number(countRow?.n) || 0,
    createdAt: roleRow.createdAt,
    updatedAt: roleRow.updatedAt,
    permissions: permRows.map((p) => ({
      slug: p.slug,
      name: p.name,
      group: p.group,
    })),
  }
}

/**
 * Fetches all 5 role rows (admin role picker). Used by the user-management
 * UI to populate the role checkbox list when assigning roles to a user.
 */
export async function listRolesForPicker(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const client = await db()
  const rows = await client
    .select({ id: roles.id, name: roles.name, slug: roles.slug })
    .from(roles)
    .orderBy(asc(roles.name))
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
}

// Re-export isForeignKeyViolation so the route layer can import it from
// the service barrel if needed (matches people.ts pattern).
export { isForeignKeyViolation }
