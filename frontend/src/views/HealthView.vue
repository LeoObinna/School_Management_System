<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import { useHealthStore } from '@/stores/health'
import type { ServiceStatus } from '@/types/api'

const healthStore = useHealthStore()
const { data, loading, error } = storeToRefs(healthStore)

onMounted(() => {
  void healthStore.refresh()
})

function badgeTone(status: ServiceStatus | undefined): 'success' | 'danger' {
  return status === 'up' ? 'success' : 'danger'
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <BaseCard title="Backend health">
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center gap-3 py-6 text-sm text-content-muted">
        <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Contacting the API…
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="py-4">
        <BaseBadge tone="danger">API unreachable</BaseBadge>
        <p class="mt-3 text-sm text-content-muted">{{ error.message }}</p>
        <BaseButton class="mt-4" variant="secondary" @click="void healthStore.refresh()">
          Retry
        </BaseButton>
      </div>

      <!-- Success state -->
      <div v-else-if="data">
        <div class="mb-4 flex items-center gap-3">
          <BaseBadge :tone="data.status === 'ok' ? 'success' : 'warning'">
            Overall: {{ data.status }}
          </BaseBadge>
          <span class="text-sm text-content-muted">API version {{ data.version }}</span>
        </div>

        <dl class="divide-y divide-slate-100 text-sm">
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-content-muted">PostgreSQL</dt>
            <dd><BaseBadge :tone="badgeTone(data.services.database)">{{ data.services.database }}</BaseBadge></dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-content-muted">Redis / Valkey</dt>
            <dd><BaseBadge :tone="badgeTone(data.services.redis)">{{ data.services.redis }}</BaseBadge></dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-content-muted">Server time</dt>
            <dd class="font-medium text-content">{{ formatTime(data.time) }}</dd>
          </div>
        </dl>

        <BaseButton class="mt-4" variant="secondary" :loading="loading" @click="void healthStore.refresh()">
          Refresh
        </BaseButton>
      </div>

      <!-- Empty state -->
      <div v-else class="py-6 text-sm text-content-muted">No health data available.</div>
    </BaseCard>
  </div>
</template>
