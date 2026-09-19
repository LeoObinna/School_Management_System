import { defineConfig } from 'vitest/config'
import { jsquashWasmLoader } from './build/jsquash-wasm-loader'

/**
 * Vitest configuration for the SMS app.
 *
 * Uses plain vitest (not @nuxt/test-utils) for Nuxt 4 + Vitest 5
 * compatibility. Nuxt component tests can use @vue/test-utils directly.
 */
export default defineConfig({
  // Same @jsquash `.wasm` → WebAssembly.Module loader the Worker build
  // uses, so thumbnail codec tests run the real WASM in Node.
  plugins: [jsquashWasmLoader()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts'],
    // @jsquash ships raw .wasm assets inside node_modules; without
    // inlining, the SSR runner externalizes them and Node's own loader
    // tries (and fails) to import them natively. Inline forces the files
    // through Vite where jsquashWasmLoader compiles them.
    server: {
      deps: {
        inline: [/@jsquash/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['components/**', 'composables/**', 'server/**', 'shared/**', 'utils/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/.nuxt/**', '**/node_modules/**'],
    },
  },
})
