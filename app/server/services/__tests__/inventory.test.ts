/**
 * Phase 14C inventory service tests.
 *
 * The Drizzle DB layer is mocked so we assert stock-invariant
 * enforcement, unique-identifier handling, pagination mapping and
 * 404 behavior without a live D1 runtime.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let countValue = 0
let listRows: Array<{
  item: Record<string, unknown>
  createdByName: string | null
}> = []
let existingRows: Array<Record<string, unknown>> = []
let inserted: Record<string, unknown> | null = null
let updateSet: Record<string, unknown> | null = null
let insertThrowsUnique = false

function makeChain(state: { kind: string; selectArg?: unknown }) {
  const s = {
    hasLeftJoin: false,
    hasReturning: false,
  }
  const chain: Record<string, unknown> = {
    select: (arg: unknown) => makeChain({ kind: 'select', selectArg: arg }),
    from: () => chain,
    leftJoin: () => {
      s.hasLeftJoin = true
      return chain
    },
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    set: (v: Record<string, unknown>) => {
      updateSet = v
      return chain
    },
    values: (v: Record<string, unknown>) => {
      inserted = v
      return chain
    },
    returning: () => {
      s.hasReturning = true
      return chain
    },
    then: (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      if (s.hasReturning) {
        if (state.kind === 'insert' && insertThrowsUnique) {
          reject?.(
            Object.assign(new Error('UNIQUE constraint failed'), {
              code: 'SQLITE_CONSTRAINT_UNIQUE',
            }),
          )
          return
        }
        resolve([{ id: 'inv-1' }])
        return
      }
      if (s.hasLeftJoin) {
        resolve(listRows)
        return
      }
      const arg = state.selectArg as { n?: unknown } | undefined
      if (arg && typeof arg === 'object' && 'n' in arg) {
        resolve([{ n: countValue }])
        return
      }
      resolve(existingRows)
    },
  }
  return chain
}

vi.mock('../../utils/db', () => ({
  db: Promise.resolve({
    select: (arg?: unknown) => makeChain({ kind: 'select', selectArg: arg }),
    insert: () => makeChain({ kind: 'insert' }),
    update: () => makeChain({ kind: 'update' }),
    delete: () => makeChain({ kind: 'delete' }),
  }),
}))

import {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  applyStockDelta,
} from '../inventory'

function itemRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    name: 'Maths Textbook P4',
    itemType: 'book',
    category: 'Textbook',
    identifier: '9780000000001',
    quantity: 30,
    availableQuantity: 25,
    location: 'Shelf A',
    condition: 'good',
    status: 'active',
    notes: null,
    createdById: 'u-admin',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...over,
  }
}

describe('inventory service — reads', () => {
  beforeEach(() => {
    countValue = 0
    listRows = []
    existingRows = []
    inserted = null
    updateSet = null
    insertThrowsUnique = false
  })

  it('maps list rows with uploader name and pagination meta', async () => {
    countValue = 1
    listRows = [{ item: itemRow(), createdByName: 'Admin User' }]
    const result = await listInventoryItems({
      page: 1,
      perPage: 20,
      order: 'asc',
    })
    expect(result.meta.total).toBe(1)
    expect(result.meta.lastPage).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.name).toBe('Maths Textbook P4')
    expect(result.data[0]?.createdByName).toBe('Admin User')
  })

  it('returns 404 when an item is missing', async () => {
    listRows = []
    await expect(getInventoryItem('missing')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('inventory service — create', () => {
  beforeEach(() => {
    countValue = 0
    listRows = []
    existingRows = []
    inserted = null
    updateSet = null
    insertThrowsUnique = false
  })

  it('defaults available quantity to total when not supplied', async () => {
    listRows = [{ item: itemRow({ quantity: 10, availableQuantity: 10 }), createdByName: null }]
    const created = await createInventoryItem(
      {
        name: 'Globe',
        itemType: 'equipment',
        category: null,
        identifier: null,
        quantity: 10,
        location: null,
        condition: 'new',
        status: 'active',
        notes: null,
      },
      'u-admin',
    )
    expect(inserted?.quantity).toBe(10)
    expect(inserted?.availableQuantity).toBe(10)
    expect(inserted?.createdById).toBe('u-admin')
    expect(created.availableQuantity).toBe(10)
  })

  it('maps a unique identifier clash to a field error', async () => {
    insertThrowsUnique = true
    await expect(
      createInventoryItem(
        {
          name: 'Dup',
          itemType: 'book',
          category: null,
          identifier: '9780000000001',
          quantity: 1,
          location: null,
          condition: 'good',
          status: 'active',
          notes: null,
        },
        'u-admin',
      ),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('inventory service — update / delete', () => {
  beforeEach(() => {
    countValue = 0
    listRows = []
    existingRows = []
    inserted = null
    updateSet = null
    insertThrowsUnique = false
  })

  it('rejects making available exceed total via partial update', async () => {
    existingRows = [itemRow({ quantity: 5, availableQuantity: 5 })]
    await expect(
      updateInventoryItem('inv-1', { availableQuantity: 9 }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('allows reducing available below total and bumps updatedAt', async () => {
    existingRows = [itemRow({ quantity: 10, availableQuantity: 10 })]
    listRows = [
      { item: itemRow({ quantity: 10, availableQuantity: 7 }), createdByName: null },
    ]
    const updated = await updateInventoryItem('inv-1', { availableQuantity: 7 })
    expect(updateSet?.availableQuantity).toBe(7)
    expect(updateSet?.updatedAt).toBeTruthy()
    expect(updated.availableQuantity).toBe(7)
  })

  it('rejects total quantity below existing available', async () => {
    existingRows = [itemRow({ quantity: 10, availableQuantity: 8 })]
    // Lowering total to 5 while available stays 8 violates the invariant.
    await expect(
      updateInventoryItem('inv-1', { quantity: 5 }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('returns 404 on update of a missing item', async () => {
    existingRows = []
    await expect(
      updateInventoryItem('missing', { status: 'retired' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deletes an existing item', async () => {
    existingRows = [itemRow()]
    await expect(deleteInventoryItem('inv-1')).resolves.toBeUndefined()
  })

  it('returns 404 on delete of a missing item', async () => {
    existingRows = []
    await expect(deleteInventoryItem('missing')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('applyStockDelta', () => {
  it('adds stock to both totals', () => {
    expect(
      applyStockDelta(
        { quantity: 10, availableQuantity: 8 },
        { quantityDelta: 5, availableDelta: 5 },
      ),
    ).toEqual({ quantity: 15, availableQuantity: 13 })
  })

  it('withholds available without changing total', () => {
    expect(
      applyStockDelta(
        { quantity: 10, availableQuantity: 10 },
        { availableDelta: -2 },
      ),
    ).toEqual({ quantity: 10, availableQuantity: 8 })
  })

  it('rejects an adjustment that makes stock invalid', () => {
    expect(() =>
      applyStockDelta(
        { quantity: 3, availableQuantity: 3 },
        { availableDelta: 1 },
      ),
    ).toThrow()
    expect(() =>
      applyStockDelta(
        { quantity: 3, availableQuantity: 1 },
        { quantityDelta: -5 },
      ),
    ).toThrow()
  })
})
