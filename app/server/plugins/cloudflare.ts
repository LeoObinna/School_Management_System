/**
 * Cloudflare Workers runtime integration.
 *
 * Bindings and secrets are delivered per request on
 * `event.context.cloudflare.env`.
 *
 * Two responsibilities:
 *
 * 1. RUNTIME CONFIG BRIDGE. nuxt.config.ts ships EMPTY runtimeConfig
 *    defaults because Nuxt serializes them into the deployed Worker
 *    bundle. Secrets must never live in that bundle, so they are
 *    injected here per request:
 *      - Workers: from Cloudflare bindings/secrets on cloudflare.env
 *      - Plain Node dev (`nuxt dev`): from process.env (app/.env)
 *    All handlers read useRuntimeConfig(event) as usual; by the time
 *    middleware and handlers run, this 'request' hook has populated it.
 *    Every request sees the same environment, so mutation of the shared
 *    config object is safe.
 *
 * 2. PER-REQUEST DB CLEANUP. The Drizzle/postgres.js client is created
 *    lazily PER REQUEST from the HYPERDRIVE binding (see utils/db.ts) —
 *    the Workers runtime forbids reusing a connection's socket I/O
 *    across invocations, and Hyperdrive maintains the upstream pool.
 *    The client is closed after the response is sent. In plain Node dev
 *    there is no cloudflare context; a process-wide client is used and
 *    the afterResponse hook is a no-op.
 */
import type { H3Event } from 'h3'

type CfEnv = Record<string, unknown> | undefined

function bridgeRuntimeConfig(event: H3Event): void {
  try {
    const config = useRuntimeConfig(event)
    const cloudflareEnv = (
      event.context as { cloudflare?: { env?: CfEnv } }
    ).cloudflare?.env

    const sessionSecret =
      (cloudflareEnv?.SESSION_SECRET as string | undefined)
        || process.env.SESSION_SECRET
        || ''
    if (sessionSecret) {
      config.sessionSecret = sessionSecret
    }

    // DATABASE_URL is only relevant for Node dev; Workers always use
    // HYPERDRIVE (see utils/db.ts), so no DATABASE_URL binding exists.
    const databaseUrl =
      (cloudflareEnv?.DATABASE_URL as string | undefined)
        || process.env.DATABASE_URL
        || ''
    if (databaseUrl) {
      config.databaseUrl = databaseUrl
    }

    // Bindings arrive as strings in Workers; keep the boolean parse
    // identical in both runtimes. Default stays false (fail closed).
    const exposeRaw = cloudflareEnv && 'EXPOSE_RESET_TOKENS' in cloudflareEnv
      ? cloudflareEnv.EXPOSE_RESET_TOKENS
      : process.env.EXPOSE_RESET_TOKENS
    config.exposeResetTokens =
      exposeRaw === true || String(exposeRaw ?? '') === 'true'
  } catch {
    // Never break the request lifecycle: auth handlers treat a missing
    // session secret as unauthenticated rather than crashing.
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    bridgeRuntimeConfig(event)
  })

  nitroApp.hooks.hook('afterResponse', async (event) => {
    const { closeRequestDatabase } = await import('../utils/db')
    await closeRequestDatabase(event)
  })
})
