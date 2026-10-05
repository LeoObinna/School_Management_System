/**
 * Public website contracts (Phase 18).
 *
 * These schemas describe the unauthenticated `/api/v1/public/*` payloads.
 * They are deliberately separate from the authenticated
 * `schoolPublicSettingsSchema` (any-user branding subset): the public site
 * payload includes the school's bank transfer details (shown on the fees
 * page when populated) and never exposes storage object keys — the logo is
 * referenced by the constant public route URL instead.
 *
 * Later increments extend this module with admission/contact/result
 * schemas (18C/18D).
 */
import { z } from 'zod'
import { schoolPublicSettingsSchema } from './school-settings'

/**
 * GET /api/v1/public/school-settings — identity + branding + bank details.
 * Bank fields may be empty strings; the UI hides the bank block unless all
 * three are populated. `logoUrl` is the constant streaming route
 * (`/api/v1/public/logo`) when a logo is set, otherwise null.
 */
export const publicSiteSettingsSchema = schoolPublicSettingsSchema
  .omit({ logoKey: true })
  .extend({
    logoUrl: z.string().nullable(),
    bankName: z.string().trim().max(200).optional().or(z.literal('')),
    accountName: z.string().trim().max(200).optional().or(z.literal('')),
    accountNumber: z.string().trim().max(50).optional().or(z.literal('')),
  })

/**
 * GET /api/v1/public/stats — aggregate counts for the homepage statistics
 * strip. Counts only; no personal data. Rows are filtered to active /
 * non-deleted records so the numbers reflect the current school.
 */
export const publicStatsSchema = z.object({
  students: z.number().int().nonnegative(),
  teachers: z.number().int().nonnegative(),
  classes: z.number().int().nonnegative(),
  subjects: z.number().int().nonnegative(),
})

export type PublicSiteSettings = z.infer<typeof publicSiteSettingsSchema>
export type PublicStats = z.infer<typeof publicStatsSchema>
