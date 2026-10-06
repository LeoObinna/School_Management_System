<script setup lang="ts">
/**
 * App-wide error/404 page (Phase 18D).
 *
 * Rendered outside every layout, so it carries its own branded chrome:
 * the VCS wordmark on the brand-blue field, a plain-language message
 * (same treatment for public and portal routes) and safe ways forward.
 * No internal details from `error` are shown to users.
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error.statusCode === 404)

function goHome() {
  clearError({ redirect: '/' })
}

function goToLogin() {
  clearError({ redirect: '/auth/login' })
}

function tryAgain() {
  clearError({ redirect: useRoute().fullPath })
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-primary text-white">
    <header class="mx-auto w-full max-w-content px-5 pt-8 md:px-8">
      <button
        type="button"
        class="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent"
        @click="goHome"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-brand-accent">
          Victorious Children School
        </p>
        <p class="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/70">
          Ojodu • Lagos
        </p>
      </button>
    </header>

    <main class="mx-auto flex w-full max-w-content flex-1 flex-col justify-center px-5 py-16 md:px-8">
      <p class="font-display text-display-md text-brand-accent" aria-hidden="true">
        {{ is404 ? '404' : 'Something went wrong' }}
      </p>
      <h1 class="mt-4 font-display text-h2">
        {{ is404 ? 'We could not find that page.' : 'An unexpected error occurred.' }}
      </h1>
      <p class="mt-3 max-w-xl text-body text-white/80">
        <template v-if="is404">
          The page may have moved, or the link might be incorrect. Return
          home or contact the school office for help.
        </template>
        <template v-else>
          Please try again. If the problem continues, return home or sign
          in through the portal.
        </template>
      </p>

      <div class="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-md bg-brand-accent px-5 py-2.5 text-sm font-semibold text-brand-primary transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          @click="goHome"
        >
          Go home
        </button>
        <NuxtLink
          to="/contact"
          class="rounded-md border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          @click="clearError()"
        >
          Contact us
        </NuxtLink>
        <button
          v-if="!is404"
          type="button"
          class="rounded-md border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          @click="tryAgain"
        >
          Try again
        </button>
        <button
          v-else
          type="button"
          class="rounded-md border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          @click="goToLogin"
        >
          Portal login
        </button>
      </div>
    </main>
  </div>
</template>
