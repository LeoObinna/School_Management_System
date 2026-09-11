/**
 * Offset-pagination helper for Drizzle queries (README §24).
 *
 * Returns the uniform `{ data, meta }` envelope used by every
 * collection endpoint. Count and page query share the same WHERE
 * expression; callers supply ordering and the bound Drizzle client.
 */
import { sql, type SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Schema } from '../../database/schema'
import type { Paginated } from '../../shared/types'

export type SmsDb = PostgresJsDatabase<Schema>

export interface SmsPageParams {
  page: number
  perPage: number
}

export async function smsPaginate<T>(
  db: SmsDb,
  params: {
    table: PgTable
    where?: SQL
    orderBy?: SQL | SQL[]
    page: number
    perPage: number
  },
): Promise<Paginated<T>> {
  const { table, where, orderBy, page, perPage } = params
  const offset = (page - 1) * perPage

  const countRows = await db
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
