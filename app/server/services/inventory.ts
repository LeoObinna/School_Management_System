/**
 * Inventory ledger services (README §41, Phase 14C).
 *
 * Pure D1 stock catalog of books and equipment — no R2 byte transfer.
 * Routes enforce `inventory.view` / `inventory.manage`; this service
 * validates the stock invariant 0 <= availableQuantity <= quantity and
 * maps the unique (itemType, identifier) constraint to a field error.
 */
import { and, asc, eq, like, or, sql, type SQL } from 'drizzle-orm'
import { inventoryItems, users } from '../../database/schema'
import type {
  InventoryItemCreate,
  InventoryListQuery,
  InventoryItemUpdate,
} from '../../shared/schemas'
import type {
  InventoryItemListItem,
  Paginated,
} from '../../shared/types'
import {
  isUniqueViolation,
  smsFieldError,
  smsNotFound,
} from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

function listSelect(client: SmsDb) {
  return client
    .select({
      item: inventoryItems,
      createdByName: users.name,
    })
    .from(inventoryItems)
    .leftJoin(users, eq(inventoryItems.createdById, users.id))
}

function buildFilter(query: InventoryListQuery): SQL | undefined {
  const where: Array<SQL | undefined> = [
    query.itemType ? eq(inventoryItems.itemType, query.itemType) : undefined,
    query.category ? eq(inventoryItems.category, query.category) : undefined,
    query.status ? eq(inventoryItems.status, query.status) : undefined,
    query.condition
      ? eq(inventoryItems.condition, query.condition)
      : undefined,
  ]
  if (query.search) {
    const term = `%${query.search.trim()}%`
    where.push(
      or(
        like(inventoryItems.name, term),
        like(inventoryItems.identifier, term),
        like(inventoryItems.category, term),
      )!,
    )
  }
  return and(...where.filter((c): c is SQL => c !== undefined))
}

export async function listInventoryItems(
  query: InventoryListQuery,
): Promise<Paginated<InventoryItemListItem>> {
  const client = await db()
  const filter = buildFilter(query)

  const totalRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(inventoryItems)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await listSelect(client)
    .where(filter)
    .orderBy(asc(inventoryItems.itemType), asc(inventoryItems.name))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  const data: InventoryItemListItem[] = rows.map((r) =>
    toJsonModel<InventoryItemListItem>({
      ...r.item,
      createdByName: r.createdByName ?? null,
    }),
  )

  return {
    data,
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getInventoryItem(
  id: string,
): Promise<InventoryItemListItem> {
  const client = await db()
  const [row] = await listSelect(client)
    .where(eq(inventoryItems.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Inventory item not found.')
  return toJsonModel<InventoryItemListItem>({
    ...row.item,
    createdByName: row.createdByName ?? null,
  })
}

export async function createInventoryItem(
  input: InventoryItemCreate,
  userId: string,
): Promise<InventoryItemListItem> {
  const client = await db()
  const quantity = input.quantity
  // availableQuantity defaults to the full quantity when not supplied.
  const availableQuantity = input.availableQuantity ?? quantity

  try {
    const [row] = await client
      .insert(inventoryItems)
      .values({
        name: input.name,
        itemType: input.itemType,
        category: input.category ?? null,
        identifier: input.identifier ?? null,
        quantity,
        availableQuantity,
        location: input.location ?? null,
        condition: input.condition,
        status: input.status,
        notes: input.notes ?? null,
        createdById: userId,
      })
      .returning({ id: inventoryItems.id })
    if (!row) throw smsFieldError('form', 'Item could not be saved.')
    return getInventoryItem(row.id)
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw smsFieldError(
        'identifier',
        'An item of this type already uses that identifier.',
      )
    }
    throw e
  }
}

export async function updateInventoryItem(
  id: string,
  input: InventoryItemUpdate,
): Promise<InventoryItemListItem> {
  const client = await db()
  const [existing] = await client
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1)
  if (!existing) throw smsNotFound('Inventory item not found.')

  // Merge so partial quantity/available edits still satisfy the invariant.
  const quantity = input.quantity ?? existing.quantity
  const availableQuantity =
    input.availableQuantity ?? existing.availableQuantity
  if (availableQuantity > quantity) {
    throw smsFieldError(
      'availableQuantity',
      'Available quantity cannot exceed total quantity.',
    )
  }

  const values: Record<string, unknown> = {}
  if (input.name !== undefined) values.name = input.name
  if (input.itemType !== undefined) values.itemType = input.itemType
  if (input.category !== undefined) values.category = input.category
  if (input.identifier !== undefined) values.identifier = input.identifier
  if (input.quantity !== undefined) values.quantity = input.quantity
  if (input.availableQuantity !== undefined) {
    values.availableQuantity = input.availableQuantity
  }
  if (input.location !== undefined) values.location = input.location
  if (input.condition !== undefined) values.condition = input.condition
  if (input.status !== undefined) values.status = input.status
  if (input.notes !== undefined) values.notes = input.notes
  values.updatedAt = new Date().toISOString()

  try {
    await client
      .update(inventoryItems)
      .set(values)
      .where(eq(inventoryItems.id, id))
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw smsFieldError(
        'identifier',
        'An item of this type already uses that identifier.',
      )
    }
    throw e
  }
  return getInventoryItem(id)
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const client = await db()
  const [row] = await client
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Inventory item not found.')
  await client.delete(inventoryItems).where(eq(inventoryItems.id, id))
}

/**
 * Small stock adjustment helper (write-off / restock) kept for future
 * increments; adjusts both totals within the invariant. Unused by 14C
 * routes but exercised by tests to lock the arithmetic.
 */
export function applyStockDelta(
  current: { quantity: number; availableQuantity: number },
  delta: { quantityDelta?: number; availableDelta?: number },
): { quantity: number; availableQuantity: number } {
  const quantity = current.quantity + (delta.quantityDelta ?? 0)
  const availableQuantity =
    current.availableQuantity + (delta.availableDelta ?? 0)
  if (quantity < 0 || availableQuantity < 0 || availableQuantity > quantity) {
    throw smsFieldError(
      'availableQuantity',
      'Adjustment would make stock quantities invalid.',
    )
  }
  return { quantity, availableQuantity }
}
