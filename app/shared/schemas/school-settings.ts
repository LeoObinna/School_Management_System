/**
 * School settings validation (Phase 14A).
 *
 * Settings are stored as key/value rows in `school_settings` (see
 * database/schema/core.ts). The keys follow the `school.<field>`
 * convention already used by the seed. This module defines the typed
 * surface and validates incoming updates.
 *
 * All fields are optional on update (partial upsert). The response is
 * the full settings object with defaults filled in.
 */
import { z } from 'zod'
import { emailSchema, phoneSchema } from './common'

/** Hex color: #rrggbb (case-insensitive), or empty string to clear. */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color')
  .optional()
  .or(z.literal(''))

/**
 * Fields any authenticated user may see (branding + identity). Excludes
 * bank details and internal finance/academic config.
 */
export const schoolPublicSettingsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  motto: z.string().trim().max(300).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  logoKey: z.string().trim().max(300).optional().or(z.literal('')),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
})

/** Full settings object (admin only — includes bank + finance/academic). */
export const schoolSettingsSchema = schoolPublicSettingsSchema.extend({
  currency: z.string().trim().toUpperCase().length(3).optional().or(z.literal('')),
  bankName: z.string().trim().max(200).optional().or(z.literal('')),
  accountName: z.string().trim().max(200).optional().or(z.literal('')),
  accountNumber: z.string().trim().max(50).optional().or(z.literal('')),
  academicYearStartMonth: z
    .union([
      z.coerce.number().int().min(1).max(12),
      z.literal(''),
      z.null(),
    ])
    .optional(),
})

/** Partial update body — every field optional for a PATCH-style PUT. */
export const schoolSettingsUpdateSchema = schoolSettingsSchema.partial()

export type SchoolPublicSettings = z.infer<typeof schoolPublicSettingsSchema>
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>
export type SchoolSettingsUpdate = z.infer<typeof schoolSettingsUpdateSchema>
