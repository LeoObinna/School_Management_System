// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

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
  // deployed manually with `wrangler deploy`. Supports R2, KV, Hyperdrive,
  // Queues, cron and Durable Object bindings via wrangler.toml.
  nitro: {
    preset: 'cloudflare-module',
  },

  // Pinia is configured via ~/plugins/pinia.ts (manual setup for Nuxt 4
  // compatibility — @pinia/nuxt does not yet support Nuxt 4).
  modules: [],

  // Tailwind CSS v4 via the Vite plugin
  vite: {
    plugins: [tailwindcss()],
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
    // Server-only secrets (not exposed to client)
    databaseUrl: process.env.DATABASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
    // Dev-only: surface password-reset tokens from the API until the
    // Queues-backed mailer exists (Phase 10). NEVER enable in staging/prod.
    exposeResetTokens: process.env.EXPOSE_RESET_TOKENS === 'true',
    // Public config exposed to client
    public: {
      apiBaseUrl: '/api/v1',
    },
  },
})
