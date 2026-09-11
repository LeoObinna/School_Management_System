<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const mobileNavOpen = ref(false)

const navItems = [
  { name: 'dashboard', label: 'Dashboard', to: '/' },
  { name: 'system-health', label: 'System Health', to: '/system-health' },
]

function closeMobileNav(): void {
  mobileNavOpen.value = false
}
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Sidebar (desktop) / top bar (mobile) -->
    <header
      class="border-slate-200 bg-surface lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r"
    >
      <div class="flex items-center justify-between px-5 py-4">
        <RouterLink to="/" class="flex items-center gap-3" @click="closeMobileNav">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white"
          >
            VC
          </span>
          <span class="leading-tight">
            <span class="block text-sm font-semibold text-content">
              Victorious Children
            </span>
            <span class="block text-xs text-content-muted">School SMS</span>
          </span>
        </RouterLink>
        <button
          type="button"
          class="rounded-lg p-2 text-content-muted hover:bg-slate-100 lg:hidden"
          :aria-expanded="mobileNavOpen"
          aria-label="Toggle navigation"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M3 5h14v1.5H3V5Zm0 4.25h14v1.5H3v-1.5ZM3 13.5h14V15H3v-1.5Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <nav
        class="border-t border-slate-200 px-3 py-3 lg:flex-1 lg:border-t-0"
        :class="mobileNavOpen ? 'block' : 'hidden lg:block'"
      >
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="mb-1 block rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            route.name === item.name
              ? 'bg-brand-50 text-brand-700'
              : 'text-content-muted hover:bg-slate-100 hover:text-content'
          "
          @click="closeMobileNav"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <!-- Main content -->
    <div class="lg:pl-64 lg:flex-1">
      <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <h1 v-if="route.meta.title" class="mb-6 text-2xl font-semibold tracking-tight">
          {{ route.meta.title }}
        </h1>
        <RouterView />
      </main>
    </div>
  </div>
</template>
