import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { schema } from '../../database/schema'

/**
 * Central database connection.
 *
 * In Cloudflare Workers, the connection string comes from the Hyperdrive
 * binding or environment. In local/Codespace dev, it comes from
 * DATABASE_URL.
 */
const config = useRuntimeConfig()

const connectionString = config.databaseUrl || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not configured. Set it as a Codespace Secret or environment variable.',
  )
}

// Singleton query client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/** Drizzle ORM instance with the full SMS schema. */
export const db = drizzle(client, { schema })

export { schema }
export type Schema = typeof schema
