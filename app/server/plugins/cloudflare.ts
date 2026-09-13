/**
 * Cloudflare Workers runtime integration.
 *
 * Bindings are delivered per request on
 * `event.context.cloudflare.env`. The Drizzle/postgres.js client is
 * created lazily PER REQUEST from the HYPERDRIVE binding (see
 * utils/db.ts) — the Workers runtime forbids reusing a connection's
 * socket I/O across different request invocations, and Hyperdrive
 * itself maintains the upstream connection pool.
 *
 * This plugin only closes that per-request client once the response has
 * been sent. In plain Node dev (`nuxt dev`) there is no cloudflare
 * context; the process-wide client created from DATABASE_URL is used and
 * this hook is a no-op.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', async (event) => {
    const { closeRequestDatabase } = await import('../utils/db')
    await closeRequestDatabase(event)
  })
})
