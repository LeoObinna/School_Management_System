/**
 * Auth-related validation schemas (README §25).
 *
 * Login, password reset and profile updates are validated here on both
 * client and server. The server remains the source of truth for
 * authorization decisions.
 */
import { z } from 'zod'
import { emailSchema, nameSchema } from './common'

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  passwordConfirmation: z.string().min(8),
})
  .refine((d) => d.password === d.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  passwordConfirmation: z.string().min(8),
})
  .refine((d) => d.password === d.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: z.string().trim().max(50).optional(),
  avatarUrl: z.string().url().max(2048).optional().nullable(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
