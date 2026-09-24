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
 * 2. LOCAL D1 BOOTSTRAP. In plain Node dev (`nuxt dev`) there are no
 *    Cloudflare bindings; this plugin attaches wrangler's local
 *    platform proxy ONCE at Nitro startup so utils/db.ts gets a
 *    process-wide D1 client (Miniflare, persisted under
 *    .wrangler/state/v3/d1), and disposes the proxy on Nitro close.
 *    In the Cloudflare Workers runtime the request-scoped D1 binding
 *    is used instead and this is a no-op.
 */
import type { H3Event } from 'h3'

type CfEnv = Record<string, unknown> | undefined

/**
 * True when executing inside the workerd runtime (production, preview
 * and `wrangler dev`). Plain Node/Nuxt dev identifies as Node.
 */
function isCloudflareRuntime(): boolean {
  return (
    typeof globalThis.navigator !== 'undefined'
    && globalThis.navigator.userAgent === 'Cloudflare-Workers'
  )
}

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

export default defineNitroPlugin(async (nitroApp) => {
  // Plain Node dev: attach the local D1 platform proxy before the app
  // starts serving. In the Workers runtime the DB binding is used
  // per request, so nothing to initialise here.
  if (!isCloudflareRuntime()) {
    const { initNodeDatabase, closeNodeDatabase } = await import('../utils/db')
    await initNodeDatabase()
    nitroApp.hooks.hookOnce('close', async () => {
      await closeNodeDatabase()
    })
  }

  nitroApp.hooks.hook('request', (event) => {
    bridgeRuntimeConfig(event)
  })

  nitroApp.hooks.hook('afterResponse', async (event) => {
    const { closeRequestDatabase } = await import('../utils/db')
    await closeRequestDatabase(event)
  })
})
