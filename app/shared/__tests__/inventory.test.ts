/**
 * Phase 14C inventory validation contract tests.
 */
import { describe, it, expect } from 'vitest'
import {
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryListQuerySchema,
} from '../schemas/inventory'

describe('inventoryItemCreateSchema', () => {
  it('accepts a valid item and defaults available to total qty', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'Maths Textbook P4',
      itemType: 'book',
      quantity: 30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.itemType).toBe('book')
      expect(result.data.condition).toBe('good')
      expect(result.data.status).toBe('active')
      expect(result.data.availableQuantity).toBeUndefined()
    }
  })

  it('accepts equipment with an available quantity below total', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'Projector',
      itemType: 'equipment',
      quantity: 5,
      availableQuantity: 3,
      condition: 'fair',
      location: 'Hall',
    })
    expect(result.success).toBe(true)
  })

  it('normalizes blank optional text to null', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'Atlas',
      quantity: 2,
      category: '   ',
      identifier: '',
      location: '',
      notes: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBeNull()
      expect(result.data.identifier).toBeNull()
      expect(result.data.location).toBeNull()
      expect(result.data.notes).toBeNull()
    }
  })

  it('coerces numeric strings to numbers', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'Bunsen burner',
      itemType: 'equipment',
      quantity: '12',
      availableQuantity: '10',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(12)
      expect(result.data.availableQuantity).toBe(10)
    }
  })

  it('rejects a blank name', () => {
    const result = inventoryItemCreateSchema.safeParse({ name: '   ', quantity: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects quantity below 1', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'X',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a negative available quantity', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'X',
      quantity: 5,
      availableQuantity: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects available quantity greater than total', () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: 'X',
      quantity: 5,
      availableQuantity: 6,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'availableQuantity')).toBe(
        true,
      )
    }
  })

  it('rejects an invalid item type / condition / status', () => {
    expect(
      inventoryItemCreateSchema.safeParse({ name: 'X', quantity: 1, itemType: 'vehicle' })
        .success,
    ).toBe(false)
    expect(
      inventoryItemCreateSchema.safeParse({ name: 'X', quantity: 1, condition: 'broken' })
        .success,
    ).toBe(false)
    expect(
      inventoryItemCreateSchema.safeParse({ name: 'X', quantity: 1, status: 'archived' })
        .success,
    ).toBe(false)
  })
})

describe('inventoryItemUpdateSchema', () => {
  it('accepts a partial update', () => {
    const result = inventoryItemUpdateSchema.safeParse({ status: 'retired' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty object', () => {
    expect(inventoryItemUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('inventoryListQuerySchema', () => {
  it('accepts filters and pagination', () => {
    const result = inventoryListQuerySchema.safeParse({
      page: '2',
      perPage: '10',
      itemType: 'book',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown item type filter', () => {
    expect(
      inventoryListQuerySchema.safeParse({ itemType: 'vehicle' }).success,
    ).toBe(false)
  })
})
