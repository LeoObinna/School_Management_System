import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for the SMS app.
 *
 * Uses plain vitest (not @nuxt/test-utils) for Nuxt 4 + Vitest 5
 * compatibility. Nuxt component tests can use @vue/test-utils directly.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['components/**', 'composables/**', 'server/**', 'shared/**', 'utils/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/.nuxt/**', '**/node_modules/**'],
    },
  },
})
