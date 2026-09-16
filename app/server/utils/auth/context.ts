/**
 * Per-request authentication context.
 *
 * The global middleware calls {@link loadAuthContext} once; routes read
 * the cached result via {@link getAuthContext}. Loading aggregates the
 * user's roles and explicit permission slugs with a single parameterized
 * query (Drizzle) — authorization decisions never trust client-supplied
 * roles (README §25).
 */
import type { H3Event } from 'h3'
import { sql } from 'drizzle-orm'
import { verifyToken, type SessionClaims } from './tokens'
import { getSessionToken } from './cookies'

export interface AuthContext {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    avatarUrl: string | null
    isActive: boolean
  }
  roles: string[]
  permissions: string[]
  sessionId: string
}

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext | null
    // Per-request cache of business-actor ids (Phase 12 hardening).
    // Populated lazily by `resolveActorBusinessIds` in ./actor.ts.
    actorBusinessIds?: import('./actor').ActorBusinessIds
  }
}

interface GrantRow {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  roles: string[] | null
  permissions: string[] | null
}

/**
 * Verifies the session cookie (if present) and loads the user's grants.
 * Returns null for anonymous/invalid/expired sessions. Never throws for
 * malformed input — a bad cookie is simply treated as anonymous.
 */
export async function loadAuthContext(
  event: H3Event,
): Promise<AuthContext | null> {
  if (event.context.auth !== undefined) {
    return event.context.auth
  }

  const token = getSessionToken(event)
  if (!token) {
    event.context.auth = null
    return null
  }

  const config = useRuntimeConfig(event)
  let claims: SessionClaims | null = null
  try {
    claims = await verifyToken(config.sessionSecret, token, 'session')
  } catch {
    claims = null
  }
  if (!claims) {
    event.context.auth = null
    return null
  }

  try {
    const grants = await loadUserGrants(claims.sub)
    if (!grants) {
      event.context.auth = null
      return null
    }
    event.context.auth = { ...grants, sessionId: claims.sid }
    return event.context.auth
  } catch {
    // Database unavailable — treat as anonymous; health route still works.
    event.context.auth = null
    return null
  }
}

export type UserGrants = Omit<AuthContext, 'sessionId'>

/** Loads a user's profile, role slugs and permission slugs. */
export async function loadUserGrants(userId: string): Promise<UserGrants | null> {
  const { db } = await import('../db')
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.avatar_url,
      u.is_active,
      COALESCE(array_agg(DISTINCT r.slug) FILTER (WHERE r.slug IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT p.slug) FILTER (WHERE p.slug IS NOT NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = ${userId}
      AND u.is_active = true
      AND u.deleted_at IS NULL
    GROUP BY u.id
    LIMIT 1
  `)
  const row = result[0] as GrantRow | undefined
  if (!row) {
    return null
  }
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
    },
    roles: row.roles ?? [],
    permissions: row.permissions ?? [],
  }
}

export function getAuthContext(event: H3Event): AuthContext | null {
  return event.context.auth ?? null
}
