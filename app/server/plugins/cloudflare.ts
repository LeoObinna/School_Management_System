/**
 * Cloudflare Workers runtime integration.
 *
 * In the Workers runtime (cloudflare-module preset, including `wrangler
 * dev`), bindings are delivered per request on
 * `event.context.cloudflare.env`. The HYPERDRIVE binding exposes a
 * Postgres connection string that is stable for the whole isolate, so we
 * lazily initialise the shared Drizzle client on the first request.
 *
 * In plain Node dev (`nuxt dev`) the cloudflare context is absent; the
 * client is created lazily from DATABASE_URL instead (see utils/db.ts).
 */
interface CloudflareBindingEnv {
  HYPERDRIVE?: {
    connectionString?: string
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const env = (
      event.context as { cloudflare?: { env?: CloudflareBindingEnv } }
    ).cloudflare?.env

    const connectionString = env?.HYPERDRIVE?.connectionString
    if (connectionString) {
      const { initDatabase } = await import('../utils/db')
      // Hyperdrive pools at the edge — one connection per isolate.
      initDatabase(connectionString, { max: 1 })
    }
  })
})
