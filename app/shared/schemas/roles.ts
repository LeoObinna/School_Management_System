/**
 * Roles & permissions viewer schemas (Phase 6).
 *
 * The roles page is intentionally read-only — the seeder is the source
 * of truth for system role definitions, so admin mutation of role slugs
 * or permission grants is intentionally out of scope. Only pagination is
 * exposed here; the detail endpoint takes an `{ id }` path param.
 */
import { z } from 'zod'
import { idParamSchema, paginationQuerySchema } from './common'

export const roleListQuerySchema = paginationQuerySchema
export type RoleListQuery = z.infer<typeof roleListQuerySchema>

export const roleIdParamSchema = idParamSchema
export type RoleIdParam = z.infer<typeof roleIdParamSchema>
