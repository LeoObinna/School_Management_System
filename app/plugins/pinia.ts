import { createPinia } from 'pinia'

/**
 * Pinia setup plugin.
 *
 * We configure Pinia manually (rather than via @pinia/nuxt) for Nuxt 4
 * compatibility. Stores live in ~/stores and are auto-imported.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia()
  nuxtApp.vueApp.use(pinia)
})
