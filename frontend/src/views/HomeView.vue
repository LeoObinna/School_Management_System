<script setup lang="ts">
import { RouterLink } from 'vue-router'

import BaseCard from '@/components/ui/BaseCard.vue'

const stack = [
  { name: 'Vue 3 + TypeScript', detail: 'Composition API, strict TypeScript' },
  { name: 'Vite', detail: 'Dev server and production build' },
  { name: 'Vue Router + Pinia', detail: 'Routing foundation and shared state' },
  { name: 'Tailwind CSS', detail: 'Token-based design system' },
]
</script>

<template>
  <div class="space-y-6">
    <BaseCard title="Phase 0 — Foundation">
      <p class="text-sm leading-6 text-content-muted">
        The authenticated School Management System foundation is in place.
        Business modules (students, academics, attendance, finance and others)
        are delivered in later phases per the Master README.
      </p>
    </BaseCard>

    <BaseCard title="Frontend stack">
      <ul class="divide-y divide-slate-100 text-sm">
        <li v-for="item in stack" :key="item.name" class="flex flex-col py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span class="font-medium text-content">{{ item.name }}</span>
          <span class="text-content-muted">{{ item.detail }}</span>
        </li>
      </ul>
      <div class="mt-4">
        <RouterLink
          to="/system-health"
          class="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Check API, database and Redis status →
        </RouterLink>
      </div>
    </BaseCard>
  </div>
</template>
