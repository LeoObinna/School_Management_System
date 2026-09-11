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

  // Deploy to Cloudflare Pages (Workers runtime). Supports R2, KV,
  // Hyperdrive, Queues, and Durable Object bindings via wrangler.toml.
  nitro: {
    preset: 'cloudflare-pages',
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
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || 'sms-staging',
    },
    // Public config exposed to client
    public: {
      apiBaseUrl: '/api/v1',
    },
  },
})
