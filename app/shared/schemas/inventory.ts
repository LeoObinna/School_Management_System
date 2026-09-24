/**
 * Inventory ledger validation schemas (Phase 14C).
 *
 * Shared by the client create/edit forms and the Nitro routes so both
 * validate identically. Bulk-quantity stock: 0 <= availableQuantity
 * <= quantity. Empty optional text fields are normalized to null.
 */
import { z } from 'zod'
import { paginationQuerySchema } from './common'

export const inventoryItemTypeSchema = z.enum(['book', 'equipment'])
export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>

export const inventoryConditionSchema = z.enum([
  'new',
  'good',
  'fair',
  'poor',
  'damaged',
])
export type InventoryCondition = z.infer<typeof inventoryConditionSchema>

export const inventoryStatusSchema = z.enum(['active', 'retired'])
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>

/** Optional trimmed text; blank becomes null. */
const nullableText = (max: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null) return null
    const s = String(v).trim()
    return s.length === 0 ? null : s
  }, z.string().max(max).nullable())

export const inventoryItemCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    itemType: inventoryItemTypeSchema.default('book'),
    category: nullableText(100),
    identifier: nullableText(100),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    availableQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
    location: nullableText(255),
    condition: inventoryConditionSchema.default('good'),
    status: inventoryStatusSchema.default('active'),
    notes: nullableText(2000),
  })
  .refine((d) => (d.availableQuantity ?? d.quantity) <= d.quantity, {
    message: 'Available quantity cannot exceed total quantity.',
    path: ['availableQuantity'],
  })
export type InventoryItemCreate = z.infer<typeof inventoryItemCreateSchema>

export const inventoryItemUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    itemType: inventoryItemTypeSchema,
    category: nullableText(100),
    identifier: nullableText(100),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    availableQuantity: z.coerce.number().int().min(0).max(1_000_000),
    location: nullableText(255),
    condition: inventoryConditionSchema,
    status: inventoryStatusSchema,
    notes: nullableText(2000),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided.',
  })
export type InventoryItemUpdate = z.infer<typeof inventoryItemUpdateSchema>

export const inventoryListQuerySchema = paginationQuerySchema.extend({
  itemType: inventoryItemTypeSchema.optional(),
  category: z.string().trim().max(100).optional(),
  status: inventoryStatusSchema.optional(),
  condition: inventoryConditionSchema.optional(),
})
export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>
