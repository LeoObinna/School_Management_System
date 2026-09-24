// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import { jsquashWasmLoader } from './build/jsquash-wasm-loader'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Use project root as srcDir so ~/ resolves to app/ and shared/
  // server/ (at root) are reachable without ~~ prefixes.
  srcDir: '.',

  // Strict TypeScript across the whole app
  typescript: {
    strict: true,
    typeCheck: false, // run `npm run type-check` separately
  },

  // Deploy to Cloudflare Workers via the Nitro cloudflare-module preset:
  // outputs .output/server/index.mjs (Worker) + .output/public (assets),
  // deployed manually with `wrangler deploy`. Supports R2, KV, D1,
  // Queues, cron and Durable Object bindings via wrangler.toml.
  nitro: {
    preset: 'cloudflare-module',
    // Enables h3's AsyncLocalStorage event context so shared utilities
    // (e.g. the DB layer resolving the per-request D1 client) can
    // call useEvent() outside the route handler, including in Workers.
    experimental: {
      asyncContext: true,
      // Enables Nitro Tasks scanning (server/tasks/**) so the Cron
      // Trigger can dispatch publish-scheduled-announcements.
      tasks: true,
    },
    // Cron Triggers (Phase 13): the every-5-minute schedule in
    // wrangler.toml dispatches the task defined in
    // server/tasks/publish-scheduled-announcements.ts. Nitro registers
    // tasks by their file-derived name (filename without extension),
    // so the entry MUST match exactly. The task publishes announcements
    // whose status='scheduled' and scheduled_for is due.
    scheduledTasks: {
      '*/5 * * * *': ['publish-scheduled-announcements'],
    },
    // Inline the @jsquash WASM codecs (gallery thumbnails) as compiled
    // WebAssembly.Module exports; see build/jsquash-wasm-loader.ts.
    // NOTE: the Node-only `wrangler` import used by `nuxt dev`
    // (getPlatformProxy in server/utils/db.ts) is kept out of this
    // bundle by making the dynamic import non-literal there. Do NOT
    // add `wrangler` to rollupConfig.external: Rollup would render a
    // literal external import("wrangler") in output, which wrangler's
    // own esbuild pass would then try to bundle (failing on its CLI).
    rollupConfig: {
      plugins: [jsquashWasmLoader()],
    },
  },

  // Pinia is configured via ~/plugins/pinia.ts (manual setup for Nuxt 4
  // compatibility — @pinia/nuxt does not yet support Nuxt 4).
  modules: [],

  // Tailwind CSS v4 via the Vite plugin
  vite: {
    plugins: [tailwindcss(), jsquashWasmLoader()],
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Victorious Children SMS',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  runtimeConfig: {
    // Server-only secrets. These MUST stay empty here: Nuxt serializes
    // runtimeConfig defaults INTO the deployed Worker bundle, so reading
    // process.env at build time would ship SESSION_SECRET to anyone who
    // can fetch the Worker script. Values are injected PER REQUEST at
    // runtime instead — see server/plugins/cloudflare.ts (Cloudflare
    // bindings in Workers, process.env loaded from app/.env in plain
    // Node dev).
    sessionSecret: '',
    // Dev-only: surface password-reset tokens from the API until the
    // Queues-backed mailer exists (Phase 10). NEVER enabled in
    // staging/prod. Resolved per request in the cloudflare plugin.
    exposeResetTokens: false,
    // Public config exposed to client
    public: {
      apiBaseUrl: '/api/v1',
    },
  },
})
