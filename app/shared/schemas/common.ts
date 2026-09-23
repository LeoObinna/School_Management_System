/**
 * Shared validation primitives (zod) used by both client forms and
 * server API routes.
 *
 * Keeping these in `shared/` guarantees the browser and Nitro server
 * validate inputs identically. Domain-specific schemas live alongside
 * these and are re-exported from the barrel.
 */
import { z } from 'zod'

// UUID v4
export const uuidSchema = z.string().uuid()

// ISO 8601 date (YYYY-MM-DD) — used for dates, not timestamps.
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')

// Exact decimal money string, e.g. "1200.50". Kept for backward-compatible
// string-transport paths; new money fields use `koboSchema` (D1 Phase 4b).
export const moneyStringSchema = z
  .string()
  .regex(/^-?\d{1,10}(\.\d{1,2})?$/, 'Expected a decimal amount')

// Integer kobo (₦1 = 100 kobo). The authoritative money type post-D1.
// Negative amounts are rejected; refunds use a separate domain primitive.
export const koboSchema = z.number().int().min(0)

// Non-empty trimmed short/long text helpers.
export const nameSchema = z.string().trim().min(1).max(150)
export const emailSchema = z.string().trim().toLowerCase().email().max(255)
export const phoneSchema = z
  .string()
  .trim()
  .max(50)
  .regex(/^[+0-9()\-\s]{7,50}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''))

// Boolean from a query string: "true"/"1" -> true, "false"/"0" -> false.
// z.coerce.boolean() cannot be used here because Boolean("false") === true.
export const booleanParamSchema = z.preprocess((v) => {
  if (v === undefined || v === '') {
    return undefined
  }
  if (typeof v === 'boolean') {
    return v
  }
  return String(v).toLowerCase() === 'true' || v === '1'
}, z.boolean().optional())

// Standard list/pagination query params.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  sort: z.string().trim().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type PaginationQuery = z.infer<typeof paginationQuerySchema>

// Generic by-id params.
export const idParamSchema = z.object({ id: uuidSchema })
export type IdParam = z.infer<typeof idParamSchema>
