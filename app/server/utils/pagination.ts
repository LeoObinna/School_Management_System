/**
 * Offset-pagination helper for Drizzle queries (README §24).
 *
 * Returns the uniform `{ data, meta }` envelope used by every
 * collection endpoint. Count and page query share the same WHERE
 * expression; callers supply ordering and the bound Drizzle client.
 */
import { sql, type SQL } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { AppDatabase } from './db'
import type { Paginated } from '../../shared/types'

/**
 * Canonical service-layer Drizzle client type. Alias preserved to
 * avoid churn across ~40 `client: SmsDb` annotations; it resolves to
 * the schema-bound D1/SQLite client defined in `./db`.
 */
export type SmsDb = AppDatabase

/**
 * The non-empty tuple type D1's `db.batch()` requires. Multi-statement
 * batches are built conditionally, so they are accumulated as plain
 * mutable {@link D1BatchItem} arrays and handed to {@link runBatch}.
 */
export type D1BatchStatements = Parameters<SmsDb['batch']>[0]

/** One statement in a D1 batch (insert/update/delete builder). */
export type D1BatchItem = D1BatchStatements[number]

/**
 * Runs a conditionally-built batch. Drizzle types `batch()` as a
 * non-empty tuple (which cannot be pushed to), while service code
 * accumulates a mutable array; the cast bridges the two and the
 * non-empty precondition is guaranteed by every call site.
 */
export function runBatch(
  db: SmsDb,
  items: D1BatchItem[],
): Promise<unknown[]> {
  return db.batch(items as unknown as D1BatchStatements) as unknown as Promise<unknown[]>
}

/**
 * D1 caps a single prepared statement at 100 bound variables. Multi-row
 * INSERTs built from bulk payloads (scores, attendance, invoice items)
 * must be split into chunks; pass the number of bound columns each row
 * contributes. Each chunk is a separate statement — issue them
 * sequentially or inside one `db.batch()` (max 100 statements/batch).
 */
export function chunkRows<T>(
  rows: readonly T[],
  bindsPerRow: number,
  maxBinds = 100,
): T[][] {
  const size = Math.max(1, Math.floor(maxBinds / bindsPerRow))
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

export interface SmsPageParams {
  page: number
  perPage: number
}

export async function smsPaginate<T>(
  db: SmsDb,
  params: {
    table: SQLiteTable
    where?: SQL
    orderBy?: SQL | SQL[]
    page: number
    perPage: number
  },
): Promise<Paginated<T>> {
  const { table, where, orderBy, page, perPage } = params
  const offset = (page - 1) * perPage

  const countRows = await db
    .select({ total: sql<number>`cast(count(*) as integer)` })
    .from(table)
    .where(where)
  const total = countRows[0]?.total ?? 0

  const orderList = orderBy
    ? Array.isArray(orderBy)
      ? orderBy
      : [orderBy]
    : []
  const data = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(...orderList)
    .limit(perPage)
    .offset(offset)

  return {
    data: data as unknown as T[],
    meta: {
      currentPage: page,
      perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
    },
  }
}
