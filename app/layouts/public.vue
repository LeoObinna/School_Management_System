<script setup lang="ts">
/**
 * Public website shell (Phase 18). Applied explicitly via
 * `definePageMeta({ layout: 'public', public: true })`.
 *
 * There is intentionally NO layouts/default.vue: portal pages render
 * with their own chrome and must not pick up this shell implicitly.
 */
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-text-primary">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-button focus:text-text-inverse"
    >
      Skip to main content
    </a>

    <PublicSiteHeader />

    <main id="main-content" tabindex="-1" class="flex-1 focus:outline-none">
      <slot />
    </main>

    <PublicSiteFooter />
  </div>
</template>
