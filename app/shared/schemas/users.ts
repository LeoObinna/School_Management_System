/**
 * User account + admin user-management validation schemas (Phase 6).
 *
 * These cover the admin "user management" surface: listing every login
 * account, creating standalone admin/operator accounts, suspending or
 * reactivating them, admin-initiated password reset, and assigning roles
 * to a user. Person-creation flows (POST /students, /parents, …) keep
 * their own implicit user-creation paths; this schema is for the explicit
 * admin surface that the PRD §5 lists as a gap.
 */
import { z } from 'zod'
import {
  booleanParamSchema,
  emailSchema,
  nameSchema,
  paginationQuerySchema,
  phoneSchema,
  uuidSchema,
} from './common'

const GENDERS = ['male', 'female', 'other'] as const

const userBaseSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(256),
  phone: phoneSchema,
  gender: z.enum(GENDERS).optional(),
  isActive: z.boolean().optional(),
})

export const userCreateSchema = userBaseSchema
export type UserCreate = z.infer<typeof userCreateSchema>

export const userUpdateSchema = userBaseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No changes provided.',
  })
export type UserUpdate = z.infer<typeof userUpdateSchema>

export const userListQuerySchema = paginationQuerySchema.extend({
  role: z.string().trim().max(50).optional(),
  isActive: booleanParamSchema,
  search: z.string().trim().max(255).optional(),
})
export type UserListQuery = z.infer<typeof userListQuerySchema>

/** Body for POST /users/{id}/reset-password. */
export const adminResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(256),
})
export type AdminResetPassword = z.infer<typeof adminResetPasswordSchema>

/** Body for PUT /users/{id}/roles — replaces the user's role set. */
export const userRolesUpdateSchema = z.object({
  roleIds: uuidSchema.array().min(1).max(10),
})
export type UserRolesUpdate = z.infer<typeof userRolesUpdateSchema>
