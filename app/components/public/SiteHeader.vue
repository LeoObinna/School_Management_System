<script setup lang="ts">
/**
 * Public site header (brief §5, 08 §10 wordmark treatment).
 *
 * - Sticky white surface; wordmark block left, nav + portal actions right.
 * - Actions: Apply Now (primary), Pay Fees, Check Results, Portal Login.
 *   Pay Fees routes to the portal login — fee payment is authenticated.
 * - Below lg the navigation collapses into a brand-blue drawer
 *   (08 §35: focus management, background blocked, obvious close).
 *
 * Routes land with Phase 18's public pages; the shell is dormant until
 * a page applies `layout: 'public'`.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { publicNavLinks } from './links'

const route = useRoute()

function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

const drawerOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

function openDrawer(): void {
  drawerOpen.value = true
}

/** Escape / overlay close returns focus to the trigger (08 §51). */
function closeDrawer(restoreFocus: boolean): void {
  drawerOpen.value = false
  if (restoreFocus) menuButton.value?.focus()
}

// Route changes close the drawer without stealing focus from the
// freshly navigated page.
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

watch(drawerOpen, async (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    await nextTick()
    closeButton.value?.focus()
  }
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && drawerOpen.value) closeDrawer(true)
}

onMounted(() => document.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border-default bg-surface">
    <div
      class="mx-auto flex h-20 max-w-content items-center justify-between gap-4 px-5 md:px-6 xl:px-8"
    >
      <!-- Wordmark (08 §10): VICTORIOUS dominant, location support. -->
      <NuxtLink
        to="/"
        class="flex min-w-0 items-center"
        aria-label="Victorious Children School, Ojodu, Lagos — home"
      >
        <span class="flex flex-col leading-none">
          <span class="text-xl font-extrabold tracking-[0.04em] text-brand-primary">
            VICTORIOUS
          </span>
          <span
            class="mt-1 text-[0.6875rem] font-semibold tracking-[0.2em] text-text-secondary"
          >
            CHILDREN SCHOOL
          </span>
          <span
            class="mt-1 text-[0.625rem] font-medium tracking-[0.16em] text-text-muted"
          >
            OJODU • LAGOS
          </span>
        </span>
      </NuxtLink>

      <!-- Desktop navigation -->
      <nav class="hidden lg:flex lg:items-center lg:gap-1" aria-label="Primary">
        <NuxtLink
          v-for="link in publicNavLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-2 text-button transition-colors duration-150 hover:bg-surface-subtle hover:text-brand-primary"
          :class="isActive(link.to) ? 'text-brand-primary underline decoration-brand-accent decoration-2 underline-offset-8' : 'text-text-secondary'"
          :aria-current="isActive(link.to) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <!-- Portal actions (brief §5). Pay Fees / Check Results join at xl. -->
      <div class="hidden items-center gap-2 lg:flex">
        <NuxtLink
          to="/auth/login"
          class="hidden rounded-md px-3 py-2 text-button text-text-secondary transition-colors hover:text-brand-primary xl:inline-flex"
        >
          Pay Fees
        </NuxtLink>
        <NuxtLink
          to="/results/checker"
          class="hidden rounded-md px-3 py-2 text-button text-text-secondary transition-colors hover:text-brand-primary xl:inline-flex"
        >
          Check Results
        </NuxtLink>
        <NuxtLink
          to="/auth/login"
          class="inline-flex h-11 items-center rounded-md border border-brand-primary px-5 text-button text-brand-primary transition-colors duration-150 hover:bg-surface-subtle"
        >
          Portal Login
        </NuxtLink>
        <NuxtLink
          to="/admissions"
          class="inline-flex h-11 items-center rounded-md bg-brand-primary px-5 text-button text-text-inverse shadow-sm transition-colors duration-150 hover:bg-primary-dark"
        >
          Apply Now
        </NuxtLink>
      </div>

      <!-- Mobile trigger + compact CTA -->
      <div class="flex items-center gap-2 lg:hidden">
        <NuxtLink
          to="/admissions"
          class="hidden h-11 items-center rounded-md bg-brand-primary px-4 text-button text-text-inverse sm:inline-flex"
        >
          Apply Now
        </NuxtLink>
        <button
          ref="menuButton"
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-md text-brand-primary hover:bg-surface-subtle"
          aria-controls="public-mobile-nav"
          :aria-expanded="drawerOpen"
          aria-label="Open menu"
          @click="openDrawer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile drawer (08 §35) -->
    <div
      v-if="drawerOpen"
      id="public-mobile-nav"
      class="mobile-drawer fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <div
        class="absolute inset-0 bg-neutral-900/60"
        aria-hidden="true"
        @click="closeDrawer(true)"
      />
      <div
        class="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-brand-primary text-text-inverse shadow-lg"
      >
        <div
          class="flex items-center justify-between border-b border-white/15 px-5 py-3"
        >
          <span class="text-label tracking-[0.2em] text-white/85">MENU</span>
          <button
            ref="closeButton"
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-inverse hover:bg-white/10"
            aria-label="Close menu"
            @click="closeDrawer(true)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
          <ul class="space-y-1">
            <li v-for="link in publicNavLinks" :key="link.to">
              <NuxtLink
                :to="link.to"
                class="block rounded-md px-3 py-3 text-body-sm font-semibold transition-colors"
                :class="isActive(link.to) ? 'bg-white/10 text-brand-accent' : 'text-text-inverse hover:bg-white/10'"
                :aria-current="isActive(link.to) ? 'page' : undefined"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="space-y-3 border-t border-white/15 px-5 py-5">
          <NuxtLink
            to="/admissions"
            class="flex h-11 items-center justify-center rounded-md bg-surface px-5 text-button text-brand-primary transition-colors hover:bg-surface-subtle"
          >
            Apply Now
          </NuxtLink>
          <div class="grid grid-cols-2 gap-2">
            <NuxtLink
              to="/auth/login"
              class="flex h-11 items-center justify-center rounded-md border border-white/40 px-3 text-button text-text-inverse hover:bg-white/10"
            >
              Pay Fees
            </NuxtLink>
            <NuxtLink
              to="/results/checker"
              class="flex h-11 items-center justify-center rounded-md border border-white/40 px-3 text-button text-text-inverse hover:bg-white/10"
            >
              Check Results
            </NuxtLink>
          </div>
          <NuxtLink
            to="/auth/login"
            class="block px-1 text-body-sm text-white/85 underline underline-offset-4 hover:text-brand-accent"
          >
            Portal Login
          </NuxtLink>
          <p class="pt-1 font-display text-lg italic text-brand-accent">
            Not to Equal, But to Excel
          </p>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Focus must stay visible on the dark drawer surface (08 §55). */
.mobile-drawer :focus-visible {
  outline-color: var(--color-brand-accent);
}
</style>
