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
 * the D1/SQLite client (with the temporary transaction shim) defined
 * in `./db` since the Phase 2 schema rewrite.
 */
export type SmsDb = AppDatabase

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
    // TODO Phase 3: `::int` is PostgreSQL syntax; switch to
    // `cast(count(*) as integer)` (valid in both) during the D1
    // raw-SQL fragment migration.
    .select({ total: sql<number>`count(*)::int` })
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
